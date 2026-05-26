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
import { registerDataReset } from '@/lib/app-data-reset-registry';

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
  const { activeProjectId, projectUpdateKey } = useProjectList();
  const { driver } = useStorage();
  const [project, setProject] = useState<Project | null>(null);

  // Load project when activeProjectId changes — async with cancellation.
  // projectUpdateKey is bumped by applyImportMerge after a local-mode replace
  // of the active project, forcing a fresh read from storage. Cloud mode uses
  // onProjectChange and never increments the key.
  useEffect(() => {
    if (!activeProjectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale project when ID is removed
      setProject(null);
      return;
    }
    let cancelled = false;
    driver.loadProject(activeProjectId).then((p) => {
      if (!cancelled) {
        setProject(p);
      }
    }).catch((err) => {
      console.error('Failed to load project:', (err as { code?: string }).code ?? 'unknown');
    });
    return () => { cancelled = true; };
  }, [activeProjectId, driver, projectUpdateKey]);

  // Subscribe to remote changes in cloud mode
  useEffect(() => {
    if (!activeProjectId || driver.mode !== 'cloud') return;
    const unsub = driver.onProjectChange(activeProjectId, (remoteProject) => {
      if (remoteProject) {
        setProject(remoteProject);
      }
    });
    return unsub;
  }, [activeProjectId, driver]);

  // I2 — Listen for access-revocation events dispatched by the Firestore driver.
  useEffect(() => {
    if (driver.mode !== 'cloud') return;
    const handleAccessRevoked = (e: Event) => {
      const custom = e as CustomEvent<{ id: string }>;
      if (custom.detail.id === activeProjectId) {
        setProject(null);
        // TODO (L1 / future): surface a user-visible message once a
        // notification channel exists.
      }
    };
    window.addEventListener('spert:project-access-revoked', handleAccessRevoked);
    return () => {
      window.removeEventListener('spert:project-access-revoked', handleAccessRevoked);
    };
  }, [driver.mode, activeProjectId]);

  // Flush pending writes on unmount
  useEffect(() => {
    return () => driver.flush();
  }, [driver]);

  // D2: Register both beforeunload (desktop) and pagehide (iOS Safari, bfcache)
  // with distinct handler references so removeEventListener can unregister each
  // independently.
  useEffect(() => {
    const handleBeforeUnload = () => driver.flush();
    const handlePageHide = () => driver.flush();
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [driver]);

  // Register a synchronous reset callback invoked by StorageProvider's
  // sign-out cleanup BEFORE the storage swap fires.
  useEffect(() => {
    return registerDataReset(() => {
      setProject(null);
    });
  }, []);

  const updateWorkflow = useCallback(
    (states: WorkflowState[]) => {
      setProject((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, workflow: states };
        driver.saveProject(updated).catch((err: unknown) => {
          console.error(
            'updateWorkflow: saveProject failed',
            (err as { code?: string }).code ?? 'unknown',
          );
        });
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
        driver.saveProject(updated).catch((err: unknown) => {
          console.error(
            'updateSnapshots: saveProject failed',
            (err as { code?: string }).code ?? 'unknown',
          );
        });
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
        driver.saveProject(updated).catch((err: unknown) => {
          console.error(
            'updateSettings: saveProject failed',
            (err as { code?: string }).code ?? 'unknown',
          );
        });
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
