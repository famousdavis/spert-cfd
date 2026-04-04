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
  type ReactNode,
} from 'react';
import type { Project, WorkflowState, Snapshot, ProjectSettings } from '@/types';
import { useProjectList } from './project-list-context';
import { useStorage } from './storage-context';

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
  const { driver } = useStorage();
  const [project, setProject] = useState<Project | null>(null);

  // Load project when activeProjectId changes — async with cancellation
  useEffect(() => {
    if (!activeProjectId) {
      setProject(null);
      return;
    }
    let cancelled = false;
    driver.loadProject(activeProjectId).then((p) => {
      if (!cancelled) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- deferred async load
        setProject(p);
      }
    });
    return () => { cancelled = true; };
  }, [activeProjectId, driver]);

  // Subscribe to remote changes in cloud mode
  useEffect(() => {
    if (!activeProjectId || driver.mode !== 'cloud') return;
    const unsub = driver.onProjectChange(activeProjectId, (remoteProject) => {
      if (remoteProject) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- real-time sync callback
        setProject(remoteProject);
      }
    });
    return unsub;
  }, [activeProjectId, driver]);

  // Flush pending writes on unmount
  useEffect(() => {
    return () => driver.flush();
  }, [driver]);

  // Flush pending writes before tab close (§8.8)
  useEffect(() => {
    const handler = () => driver.flush();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [driver]);

  const updateWorkflow = useCallback(
    (states: WorkflowState[]) => {
      setProject((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, workflow: states };
        driver.saveProject(updated);
        return updated;
      });
    },
    [driver]
  );

  const updateSnapshots = useCallback(
    (snapshots: Snapshot[]) => {
      setProject((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, snapshots };
        driver.saveProject(updated);
        return updated;
      });
    },
    [driver]
  );

  const updateSettings = useCallback(
    (patch: Partial<ProjectSettings>) => {
      setProject((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          settings: { ...prev.settings, ...patch },
        };
        driver.saveProject(updated);
        return updated;
      });
    },
    [driver]
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
