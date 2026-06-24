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
import { nanoid } from 'nanoid';
import { useStorage } from './storage-context';
import type { Project } from '@/types';
import type { ProjectListItem } from '@/lib/storage-driver';
import { MAX_NAME_LENGTH } from '@/lib/constants';
import { createSampleProject } from '@/lib/sample-data';
import { registerDataReset } from '@/lib/app-data-reset-registry';
import type {
  ImportDecisions,
  ImportConflict,
  ImportMergeOutcome,
} from '@/lib/import-utils';
import {
  computeImportMerge,
  buildNewProjectList,
  computeWriteRollback,
  shouldAutoSwitch,
  shouldIncrementProjectKey,
} from '@/lib/import-utils';

interface ProjectListContextValue {
  projects: ProjectListItem[];
  activeProjectId: string | null;
  isLoaded: boolean;
  /**
   * True while loadProjectList() is in-flight for the current driver.
   * Distinct from isLoaded: isLoaded is one-shot for the initial mount,
   * driverLoading toggles on every driver swap (e.g. mid-session cloud-flip).
   * Import call sites consult this to disable the file picker and the
   * preview's Confirm button during the hydration window.
   */
  driverLoading: boolean;
  /**
   * Bumped when the active project was replaced in local mode by an import.
   * ActiveProjectContext watches this to trigger a reload from storage.
   * Cloud mode uses onProjectChange instead (see import-utils HR4-2 note).
   */
  projectUpdateKey: number;
  createProject: (name: string) => string;
  deleteProject: (id: string) => void;
  switchProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  applyImportMerge: (args: {
    incoming: Project[];
    decisions: ImportDecisions;
    originalConflicts: ImportConflict[];
  }) => Promise<ImportMergeOutcome>;
  reorderProjects: (orderedIds: string[]) => void;
}

const ProjectListContext = createContext<ProjectListContextValue | null>(null);

export function useProjectList() {
  const ctx = useContext(ProjectListContext);
  if (!ctx) {
    throw new Error('useProjectList must be used within ProjectListProvider');
  }
  return ctx;
}

export function ProjectListProvider({ children }: { children: ReactNode }) {
  const { driver } = useStorage();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  // Cloud-mode mounts start gated; local-mode mounts need no gate (synchronous read).
  // driver is non-null here — StorageProvider short-circuits until storageReady = driver !== null.
  const [driverLoading, setDriverLoading] = useState(() => driver.mode === 'cloud');
  const [projectUpdateKey, setProjectUpdateKey] = useState(0);

  // Load project list from driver on mount
  useEffect(() => {
    let cancelled = false;
    let cloudLoadFailed = false;
    if (driver.mode === 'cloud') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional cloud-load gating (C2/M3)
      setDriverLoading(true);
    }
    (async () => {
      try {
        const list = await driver.loadProjectList();
        if (cancelled) return;

        // Sample project seeding: local mode only (§8.4)
        // In cloud mode, an empty list shows the empty state.
        if (list.length === 0 && driver.mode === 'local') {
          const sample = createSampleProject();
          await driver.createProject(sample);
          if (cancelled) return; // guard after second await
          driver.setActiveProjectId(sample.id);
          setProjects([{ id: sample.id, name: sample.name }]);
          setActiveProjectId(sample.id);
        } else {
          setProjects(list);
          setActiveProjectId(driver.getActiveProjectId());
        }
        setIsLoaded(true);
      } catch (err) {
        if (!cancelled) {
          console.error(
            'Failed to load project list:',
            (err as { code?: string }).code ?? 'unknown',
          );
          setIsLoaded(true);
          if (driver.mode === 'cloud') {
            // C2: Leave driverLoading=true for cloud failures — the user lands on an
            // empty list with a disabled Import button rather than a writable-but-stale
            // cloud workspace. Auto-recovery happens via the onProjectListChange
            // subscription (M3) when connectivity returns, or via sign-out → sign-in.
            cloudLoadFailed = true;
          }
        }
      } finally {
        if (!cancelled && !cloudLoadFailed) setDriverLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [driver]);

  // Subscribe to remote changes in cloud mode
  useEffect(() => {
    if (driver.mode !== 'cloud') return;
    const unsub = driver.onProjectListChange((list) => {
      setProjects(list);
      // M3: Auto-recover Import button after a cloud-load failure when Firestore
      // delivers data. In the normal flow driverLoading is already false — this is
      // a no-op. Gate on list.length > 0 to avoid false recovery if the subscription
      // fires with a stale empty-cache result before connectivity is restored.
      if (list.length > 0) {
        setDriverLoading(false);
      }
    });
    return unsub;
  }, [driver]);

  // Register a synchronous reset callback invoked by StorageProvider's
  // sign-out cleanup BEFORE the storage swap fires. Zeroes in-memory
  // state so the prior user's projects do not flash in the UI during
  // the onAuthStateChanged(null) cascade.
  useEffect(() => {
    return registerDataReset(() => {
      setProjects([]);
      setActiveProjectId(null);
      setIsLoaded(false);
      setDriverLoading(true); // symmetric reset; new driver effect will set false when ready
    });
  }, []);

  const createProject = useCallback(
    (name: string): string => {
      const safeName = name.slice(0, MAX_NAME_LENGTH);
      const id = nanoid(8);
      const now = new Date().toISOString();
      const project = {
        id,
        name: safeName,
        createdAt: now,
        updatedAt: now,
        workflow: [
          { id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog' as const, order: 0 },
          { id: 'dev', name: 'In Dev', color: '#3b82f6', category: 'active' as const, order: 1 },
          { id: 'done', name: 'Done', color: '#22c55e', category: 'done' as const, order: 2 },
        ],
        snapshots: [],
        settings: {
          gridSortNewestFirst: true,
          showWipWarnings: true,
          metricsPeriod: { kind: 'all' as const },
        },
      };

      // Fire and forget — driver handles persistence
      driver.createProject(project).catch((err) => {
        console.error('Failed to create project:', (err as { code?: string }).code ?? 'unknown');
      });
      driver.setActiveProjectId(id);

      setProjects((prev) => [...prev, { id, name: safeName }]);
      setActiveProjectId(id);
      return id;
    },
    [driver]
  );

  const deleteProject = useCallback(
    (id: string) => {
      driver.deleteProject(id).then(async () => {
        const list = await driver.loadProjectList();
        setProjects(list);

        // Reset active project if the deleted one was active
        if (id === activeProjectId) {
          const newActive = list[0]?.id ?? null;
          driver.setActiveProjectId(newActive);
          setActiveProjectId(newActive);
        }
      }).catch((err) => {
        console.error('Failed to delete project:', (err as { code?: string }).code ?? 'unknown');
      });
    },
    [driver, activeProjectId]
  );

  const switchProject = useCallback(
    (id: string) => {
      driver.setActiveProjectId(id);
      setActiveProjectId(id);
    },
    [driver]
  );

  const renameProject = useCallback(
    (id: string, name: string) => {
      const safeName = name.trim();
      if (!safeName || safeName.length > MAX_NAME_LENGTH) return;

      driver.loadProject(id).then((project) => {
        if (!project) return;
        const updated = { ...project, name: safeName };
        driver.saveProject(updated).catch((err) => {
          console.error('Failed to save renamed project:', (err as { code?: string }).code ?? 'unknown');
        });
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, name: safeName } : p))
        );
      }).catch((err) => {
        console.error('Failed to load project for rename:', (err as { code?: string }).code ?? 'unknown');
      });
    },
    [driver]
  );

  const applyImportMerge = useCallback(
    async ({
      incoming,
      decisions,
      originalConflicts,
    }: {
      incoming: Project[];
      decisions: ImportDecisions;
      originalConflicts: ImportConflict[];
    }): Promise<ImportMergeOutcome> => {
      // ── Layer 1: re-detect conflicts & compute apply result ───────
      const mergeResult = computeImportMerge({
        incoming,
        decisions,
        originalConflicts,
        currentProjects: projects,
      });
      if (!mergeResult.ok) {
        return { ok: false, added: 0, replaced: 0, skipped: 0, errorKind: 'drift' };
      }
      const { result } = mergeResult;

      // ── Optimistic state update (Layer 2 inside the functional updater) ─
      setProjects((prev) => buildNewProjectList(prev, result));

      // Local-mode active-project replace → bump the reload key.
      // Cloud-mode replaces flow through onProjectChange; incrementing the
      // key there would race the 200ms saveProject debounce.
      if (shouldIncrementProjectKey(driver.mode, activeProjectId, result.replaced)) {
        setProjectUpdateKey((k) => k + 1);
      }

      // ── Replace writes: fire-and-forget (debounced 200ms cloud) ────
      // saveProject uses Firestore merge:true → owner/members preserved
      // and existing _changeLog stays (buildSavePayload excludes it).
      for (const p of result.replaced) {
        driver.saveProject(p).catch((err) => {
          console.error(
            'applyImportMerge: saveProject failed',
            p.id,
            (err as { code?: string }).code ?? 'unknown',
          );
        });
      }

      // ── Add writes: awaited (createProject is non-debounced) ──────
      // Promise.resolve().then(...) coerces sync throws (e.g., localStorage
      // quota exceeded in local mode) into rejections caught by allSettled.
      // Without this, a sync throw bypasses allSettled and escapes to the
      // caller's catch with optimistic state still applied.
      //
      // Pre-existing driver race: parallel createProject calls in cloud race
      // on spertcfd_settings/{uid}.projectOrder. Display order may be wrong;
      // data correct. Documented as a known limitation for v0.13.0.
      const addedResults = await Promise.allSettled(
        result.added.map((p) =>
          Promise.resolve().then(() => driver.createProject(p)),
        ),
      );

      const { failedAddedIds, addedOk, writeFailedCount } = computeWriteRollback(
        addedResults,
        result.added,
      );

      // ── Roll back failed adds ────────────────────────────────────
      if (failedAddedIds.size > 0) {
        setProjects((prev) => prev.filter((p) => !failedAddedIds.has(p.id)));
        addedResults.forEach((r, i) => {
          if (r.status === 'rejected') {
            console.error(
              'applyImportMerge: createProject failed',
              result.added[i].id,
              (r.reason as { code?: string }).code ?? 'unknown',
            );
          }
        });
      }

      // ── Single-project auto-switch (AFTER await) ─────────────────
      // Deferred until after rollback so we only switch to a project that
      // actually exists. Applies to single-file adds and copies; never to
      // replaces, skips, or multi-project imports.
      if (shouldAutoSwitch(incoming.length, result, failedAddedIds)) {
        const newId = result.added[0].id;
        driver.setActiveProjectId(newId);
        setActiveProjectId(newId);
      }

      // ── All-adds-failed-with-no-replaces → error outcome ─────────
      // Returns ok:false so the caller routes to the error phase (red
      // banner), not the green success phase. Optimistic state has been
      // fully rolled back at this point.
      if (
        result.added.length > 0 &&
        addedOk === 0 &&
        result.replaced.length === 0
      ) {
        return {
          ok: false,
          added: 0,
          replaced: 0,
          skipped: result.skipped.length,
          addFailedCount: writeFailedCount,
          errorKind: 'write-failed',
        };
      }

      return {
        ok: true,
        added: addedOk,
        replaced: result.replaced.length, // optimistic; fire-and-forget
        skipped: result.skipped.length,
        addFailedCount: writeFailedCount > 0 ? writeFailedCount : undefined,
      };
    },
    [driver, projects, activeProjectId],
  );

  const reorderProjects = useCallback(
    (orderedIds: string[]) => {
      // Optimistic update — reorder local state immediately
      setProjects((prev) => {
        // Validate: must be a permutation of existing project IDs
        const currentIds = prev.map((p) => p.id);
        if (
          orderedIds.length !== currentIds.length ||
          new Set(orderedIds).size !== orderedIds.length ||
          !orderedIds.every((id) => currentIds.includes(id))
        ) {
          return prev; // Reject silently
        }

        const byId = new Map(prev.map((p) => [p.id, p]));
        return orderedIds.map((id) => byId.get(id)!);
      });

      // Persist via driver
      driver.reorderProjects(orderedIds);
    },
    [driver]
  );

  return (
    <ProjectListContext.Provider
      value={{
        projects,
        activeProjectId,
        isLoaded,
        driverLoading,
        projectUpdateKey,
        createProject,
        deleteProject,
        switchProject,
        renameProject,
        applyImportMerge,
        reorderProjects,
      }}
    >
      {children}
    </ProjectListContext.Provider>
  );
}
