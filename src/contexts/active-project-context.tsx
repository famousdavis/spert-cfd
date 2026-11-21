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
import type { StorageDriver } from '@/lib/storage-driver';
import { isStorageFullError } from '@/lib/storage-errors';

interface ActiveProjectContextValue {
  project: Project | null;
  workflow: WorkflowState[];
  snapshots: Snapshot[];
  settings: ProjectSettings;
  updateWorkflow: (states: WorkflowState[]) => void;
  updateSnapshots: (snapshots: Snapshot[]) => void;
  updateSettings: (patch: Partial<ProjectSettings>) => void;
  /**
   * v0.19.0 (DASH26 R25, O24): true once a save of an edit was refused because
   * the browser's storage is full. The edit stays on screen (it is in this
   * copy) and is saved with the next edit that fits. Cleared by
   * `dismissStorageFull` and by the next save that succeeds.
   */
  storageFull: boolean;
  dismissStorageFull: () => void;
}

const DEFAULT_SETTINGS: ProjectSettings = {
  gridSortNewestFirst: true,
  showWipWarnings: true,
  metricsPeriod: { kind: 'all' },
};

const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(null);

/**
 * Saves an edit without ever throwing (v0.19.0, DASH26 R25). It is called
 * INSIDE a `setProject` updater, and the local driver writes localStorage
 * synchronously: a refused write (storage full) used to throw out of the
 * updater, React took it for a render error of ActiveProjectProvider, and the
 * app's outermost boundary replaced the whole app, the edit lost (measured,
 * Opus-R1b-2 -01). Here a synchronous throw becomes a rejection like any other.
 */
function saveEdit(
  driver: StorageDriver,
  project: Project,
  where: string,
  onSaved: (storageFull: boolean) => void,
): void {
  let saved: Promise<void>;
  try {
    saved = driver.saveProject(project);
  } catch (err) {
    saved = Promise.reject(err);
  }
  saved.then(
    () => onSaved(false),
    (err: unknown) => {
      const { code, name } = (err ?? {}) as { code?: unknown; name?: unknown };
      console.error(`${where}: saveProject failed`, code ?? name ?? 'unknown');
      if (isStorageFullError(err)) onSaved(true);
    },
  );
}

export function useActiveProject() {
  const ctx = useContext(ActiveProjectContext);
  if (!ctx) {
    throw new Error('useActiveProject must be used within ActiveProjectProvider');
  }
  return ctx;
}

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const { activeProjectId, projectUpdateKey, projects, importedActiveProject } = useProjectList();
  const { driver } = useStorage();
  const [project, setProject] = useState<Project | null>(null);
  const [storageFull, setStorageFull] = useState(false);
  const dismissStorageFull = useCallback(() => setStorageFull(false), []);
  const listedName = projects.find((p) => p.id === activeProjectId)?.name;

  // Load project when activeProjectId changes — async with cancellation.
  // projectUpdateKey is bumped by applyImportMerge after a local-mode replace
  // of the active project, forcing a fresh read from storage. Cloud mode never
  // increments the key; it sets importedActiveProject (below).
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

  // v0.17.6: take a rename of the open project into this copy. renameProject
  // (ProjectListContext) saves the stored project under the new name and
  // never sees this copy, and every save below writes this copy whole, name
  // included: without this, the next edit (Add Row, a settings toggle, a
  // workflow change) wrote the old name back over the rename, in both modes.
  // Only when the list's name CHANGES, never whenever the two differ: in
  // cloud mode the doc listener can deliver another editor's rename before
  // the list listener does, and the list's older name must not replace it.
  // Nothing is saved here; the next edit saves the name with it.
  useEffect(() => {
    if (listedName === undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- adopt a rename saved by ProjectListContext (v0.17.6)
    setProject((prev) =>
      prev && prev.id === activeProjectId && prev.name !== listedName
        ? { ...prev, name: listedName }
        : prev,
    );
  }, [listedName, activeProjectId]);

  // v0.17.7: take a cloud-mode import that replaced the open project into
  // this copy. applyImportMerge saves the import and never sees this copy,
  // and the doc listener below never hears this device's own save, so before
  // this the copy kept the pre-import data and the next edit wrote it back
  // over the import. Only the fields the save writes are taken; owner,
  // members and the change log stay as loaded, as they do in the stored
  // project. Nothing is saved here; the import's own save is in flight.
  useEffect(() => {
    if (!importedActiveProject) return;
    const { id, name, workflow, snapshots, settings } = importedActiveProject;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- adopt an import saved by ProjectListContext (v0.17.7)
    setProject((prev) =>
      prev && prev.id === id ? { ...prev, name, workflow, snapshots, settings } : prev,
    );
  }, [importedActiveProject]);

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
        saveEdit(driver, updated, 'updateWorkflow', setStorageFull);
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
        saveEdit(driver, updated, 'updateSnapshots', setStorageFull);
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
        saveEdit(driver, updated, 'updateSettings', setStorageFull);
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
        storageFull,
        dismissStorageFull,
      }}
    >
      {children}
    </ActiveProjectContext.Provider>
  );
}
