// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { Project, WorkflowState, Snapshot, ProjectSettings } from '@/types';
import { loadProject, saveProject } from '@/lib/storage';
import { useProjectList } from './project-list-context';

interface ActiveProjectContextValue {
  project: Project | null;
  workflow: WorkflowState[];
  snapshots: Snapshot[];
  settings: ProjectSettings;
  updateWorkflow: (states: WorkflowState[]) => void;
  updateSnapshots: (snapshots: Snapshot[]) => void;
  updateSettings: (patch: Partial<ProjectSettings>) => void;
}

const DEFAULT_SETTINGS: ProjectSettings = {
  gridSortNewestFirst: true,
  showWipWarnings: true,
  metricsPeriod: { kind: 'all' },
};

const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(null);

export function useActiveProject() {
  const ctx = useContext(ActiveProjectContext);
  if (!ctx) {
    throw new Error('useActiveProject must be used within ActiveProjectProvider');
  }
  return ctx;
}

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const { activeProjectId } = useProjectList();
  // Start with null to avoid reading localStorage in useState initializer (SSR safety)
  const [project, setProject] = useState<Project | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingProjectRef = useRef<Project | null>(null);

  // Load project when activeProjectId changes (localStorage sync for SSR safety)
  useEffect(() => {
    if (activeProjectId) {
      const loaded = loadProject(activeProjectId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProject(loaded);
    } else {
      setProject(null);
    }
  }, [activeProjectId]);

  // Flush pending save on unmount to prevent data loss
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (pendingProjectRef.current) {
        saveProject(pendingProjectRef.current);
        pendingProjectRef.current = null;
      }
    };
  }, []);

  // Debounced save
  const debouncedSave = useCallback((updated: Project) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    pendingProjectRef.current = updated;
    saveTimeoutRef.current = setTimeout(() => {
      saveProject(updated);
      pendingProjectRef.current = null;
    }, 300);
  }, []);

  const updateWorkflow = useCallback(
    (states: WorkflowState[]) => {
      setProject((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, workflow: states };
        debouncedSave(updated);
        return updated;
      });
    },
    [debouncedSave]
  );

  const updateSnapshots = useCallback(
    (snapshots: Snapshot[]) => {
      setProject((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, snapshots };
        debouncedSave(updated);
        return updated;
      });
    },
    [debouncedSave]
  );

  const updateSettings = useCallback(
    (patch: Partial<ProjectSettings>) => {
      setProject((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          settings: { ...prev.settings, ...patch },
        };
        debouncedSave(updated);
        return updated;
      });
    },
    [debouncedSave]
  );

  return (
    <ActiveProjectContext.Provider
      value={{
        project,
        workflow: project?.workflow ?? [],
        snapshots: project?.snapshots ?? [],
        settings: project?.settings ?? DEFAULT_SETTINGS,
        updateWorkflow,
        updateSnapshots,
        updateSettings,
      }}
    >
      {children}
    </ActiveProjectContext.Provider>
  );
}
