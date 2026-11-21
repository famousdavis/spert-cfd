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
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';
import { nanoid } from 'nanoid';
import { useStorage } from './storage-context';
import type { Project } from '@/types';
import type { ProjectListItem, ProjectPlacement, StorageDriver } from '@/lib/storage-driver';
import { MAX_NAME_LENGTH } from '@/lib/constants';
import { createSampleProject } from '@/lib/sample-data';
import { buildClone, cloneName } from '@/lib/clone-project';
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
  replacedActiveInCloud,
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
   * Cloud mode sets importedActiveProject instead.
   */
  projectUpdateKey: number;
  /**
   * The project the last cloud-mode import replaced the active one with, a
   * new object per import; null until then. ActiveProjectContext takes it
   * into its copy (v0.17.7; see replacedActiveInCloud in import-utils).
   */
  importedActiveProject: Project | null;
  /**
   * Adds the card and makes it active at once; resolves with the id once the
   * project is saved. Rejects if the save fails, after removing the card and
   * restoring the previously active project.
   */
  createProject: (name: string) => Promise<string>;
  /**
   * Adds a fresh copy of the sample project, in either storage mode, with
   * the same add-and-activate behaviour and rollback as createProject.
   * Repeated loads add several projects of the same name, as createProject
   * does: no create path checks names (only import does).
   */
  loadSampleProject: () => Promise<string>;
  /**
   * v0.19.0 (DASH26 R1b): adds a copy of `source` right after it, on screen at
   * once and in the stored order, and never changes the open project (O18).
   * Resolves with the copy's id and name once it is saved; rejects if the save
   * fails, after removing the copy's tile. The caller chooses the source
   * (O20: the open project's in-memory copy, or the stored one).
   */
  cloneProject: (source: Project) => Promise<{ id: string; name: string }>;
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

function logCreateFailure(err: unknown): void {
  console.error('Failed to create project:', (err as { code?: string }).code ?? 'unknown');
}

/**
 * The list entry for a project this browser created, once its create has
 * landed. v0.19.0 (DASH26 O23, amended by Orch-DASH-2 after PR #109 review
 * -08): in cloud mode it is then the person's own, with one member, so its
 * Share shows without a reload; the list listener never delivers this
 * device's own create (measured, DASH26 R1b M1). Not before the create lands:
 * until then the document may not exist on the server, and Forecaster
 * withholds Share for the same reason. A role the listener already delivered
 * is kept. Local entries carry no role.
 */
function ownedOnceCreated(driver: StorageDriver, item: ProjectListItem): ProjectListItem {
  if (driver.mode !== 'cloud' || item.role !== undefined) return item;
  return { ...item, owner: driver.workspaceId, role: 'owner', memberCount: 1 };
}

/** `item` right after `after`, or at the end when `after` is absent or not listed. */
function insertAfter(list: ProjectListItem[], item: ProjectListItem, after?: string): ProjectListItem[] {
  const at = after === undefined ? -1 : list.findIndex((p) => p.id === after);
  return at < 0 ? [...list, item] : [...list.slice(0, at + 1), item, ...list.slice(at + 1)];
}

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
  // v0.19.0 (DASH26 O21): a swap to a cloud driver is loading from its first
  // render. Set during render, not in the load effect below: that effect runs
  // after the first render with the new driver, which showed an empty list as
  // loaded for one frame, and with it the welcome panel (Opus-R1b-1 -11).
  const [driverSeen, setDriverSeen] = useState(driver);
  if (driverSeen !== driver) {
    setDriverSeen(driver);
    if (driver.mode === 'cloud') setDriverLoading(true);
  }
  const [projectUpdateKey, setProjectUpdateKey] = useState(0);
  const [importedActiveProject, setImportedActiveProject] = useState<Project | null>(null);
  // v0.19.0 (DASH26 PR #109 review -02, G2): the list as it is NOW, for a Clone
  // that names its copy after an await (the source's read). Kept in step after
  // each commit, and at once by addProject, so a second Clone inside the first
  // one's read sees the first copy. A Clone that named from the list of the
  // render its click happened in gave both copies "X (copy)".
  const projectsRef = useRef(projects);
  useLayoutEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

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

        // v0.19.0 (DASH26 R20): an empty list stays empty, in both modes; the
        // Projects tab shows its welcome panel, and the sample loads only from
        // Load Sample. Until v0.18.0 an empty local list re-seeded the sample,
        // on a first visit and after the last project was deleted.
        // An empty list opens nothing, even when the active-project key still
        // names a project from an earlier session (Opus-R1b-2 -11).
        setProjects(list);
        setActiveProjectId(list.length === 0 ? null : driver.getActiveProjectId());
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
      setImportedActiveProject(null);
      setIsLoaded(false);
      setDriverLoading(true); // symmetric reset; new driver effect will set false when ready
    });
  }, []);

  // Adds a whole project (createProject, loadSampleProject and, since
  // v0.19.0, cloneProject come here). Without a placement it is appended and
  // made active at once; with one (Clone) it goes right after its source and
  // the open project stays as it was (DASH26 O18).
  const addProject = useCallback(
    (project: Project, placement?: ProjectPlacement): Promise<string> => {
      const { id, name } = project;
      const activate = placement === undefined;
      // Called synchronously, BEFORE the new id becomes active: the cloud
      // driver must see this create as in flight by the time the active-
      // project effects read the id. Not Promise.resolve().then(...) as in
      // applyImportMerge — that defers the call past those reads, and the
      // new project could not be opened again (measured, QC26 Q01).
      let saved: Promise<void>;
      try {
        saved = driver.createProject(project, placement);
      } catch (err) {
        // v0.19.0 (DASH26 PR #109 review -01, G1): a synchronous refusal (the
        // local driver when localStorage is full) rejects here, BEFORE
        // anything is listed or activated. Activating first, then rolling
        // back, made ActiveProjectProvider reload the open project from
        // storage, which threw away an edit kept in memory after an earlier
        // refused save (R25).
        logCreateFailure(err);
        return Promise.reject(err);
      }
      const previousActiveId = activeProjectId;
      const item: ProjectListItem = { id, name };
      if (activate) driver.setActiveProjectId(id);
      setProjects((prev) => insertAfter(prev, item, placement?.after));
      projectsRef.current = insertAfter(projectsRef.current, item, placement?.after);
      if (activate) setActiveProjectId(id);

      return saved.then(
        () => {
          setProjects((prev) => prev.map((p) => (p.id === id ? ownedOnceCreated(driver, p) : p)));
          return id;
        },
        (err) => {
          logCreateFailure(err);
          setProjects((prev) => prev.filter((p) => p.id !== id));
          // Restore the previous project only if the user has not opened
          // another meanwhile. The driver holds the live active id: every
          // switch writes it synchronously. A clone never opened, so there
          // is nothing to restore.
          if (activate && driver.getActiveProjectId() === id) {
            driver.setActiveProjectId(previousActiveId);
            setActiveProjectId(previousActiveId);
          }
          throw err;
        },
      );
    },
    [driver, activeProjectId]
  );

  const createProject = useCallback(
    (name: string): Promise<string> => {
      const safeName = name.slice(0, MAX_NAME_LENGTH);
      const now = new Date().toISOString();
      return addProject({
        id: nanoid(8),
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
      });
    },
    [addProject]
  );

  const loadSampleProject = useCallback(
    (): Promise<string> => addProject(createSampleProject()),
    [addProject]
  );

  const cloneProject = useCallback(
    (source: Project): Promise<{ id: string; name: string }> => {
      // Named, and placed, against the list as it is now (G2).
      const listed = projectsRef.current;
      const shownName = listed.find((p) => p.id === source.id)?.name ?? source.name;
      const name = cloneName(shownName, listed.map((p) => p.name));
      const clone = buildClone(source, {
        id: nanoid(8),
        name,
        now: new Date().toISOString(),
        cloudActor: driver.mode === 'cloud' ? driver.workspaceId : undefined,
      });
      const placement = { after: source.id, shownIds: listed.map((p) => p.id) };
      return addProject(clone, placement).then((id) => ({ id, name }));
    },
    [driver, addProject]
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
      // Cloud mode hands the open copy the import instead: a reload there
      // would race the 200ms saveProject debounce, and the doc listener
      // never hears this device's own save.
      if (shouldIncrementProjectKey(driver.mode, activeProjectId, result.replaced)) {
        setProjectUpdateKey((k) => k + 1);
      }
      const importedActive = replacedActiveInCloud(driver.mode, activeProjectId, result.replaced);
      if (importedActive) {
        // A new object every time, so importing the same file twice is
        // taken in twice.
        setImportedActiveProject({ ...importedActive });
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
        importedActiveProject,
        createProject,
        loadSampleProject,
        cloneProject,
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
