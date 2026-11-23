// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { nanoid } from 'nanoid';
import type { Project, PendingInvite } from '@/types';
import type { StorageDriver, ProjectListItem, ProjectPlacement, ProjectMove, MoveOutcome } from './storage-driver';
import {
  loadIndex,
  saveIndex,
  loadProject,
  saveProject,
  removeProjectData,
  deleteProject,
  exportProject,
  importProject,
} from './storage';
import { placeAfter } from './project-order';
import { moveAmongShown, sameIds } from './order-move';
import { readLocalPrefs, writeLocalPref } from './local-prefs';
import type { PrefsRead } from './project-prefs';
import { LS_ACTIVE_PROJECT, LS_WORKSPACE_ID } from './constants';

/**
 * Creates a LocalStorageDriver wrapping existing storage.ts functions
 * behind the async StorageDriver interface.
 *
 * All operations resolve immediately (localStorage is synchronous).
 */
export function createLocalStorageDriver(): StorageDriver {
  let cachedWorkspaceId: string | null = null;
  // v0.21.0 (DASH26 R2): this browser's tile colours and archive, read once,
  // then the map each change wrote (which carries another tab's changes too).
  let prefs: PrefsRead | null = null;
  const prefsListeners = new Set<(read: PrefsRead) => void>();
  const currentPrefs = (): PrefsRead => (prefs ??= { status: 'ready', prefs: readLocalPrefs() });

  return {
    mode: 'local',

    get workspaceId(): string {
      if (cachedWorkspaceId) return cachedWorkspaceId;
      let id = localStorage.getItem(LS_WORKSPACE_ID);
      if (!id) {
        id = nanoid(8);
        localStorage.setItem(LS_WORKSPACE_ID, id);
      }
      cachedWorkspaceId = id;
      return id;
    },

    // ── List operations ───────────────────────────────────

    loadProjectList(): Promise<ProjectListItem[]> {
      const index = loadIndex();
      const list: ProjectListItem[] = [];
      for (const id of index.projectIds) {
        const project = loadProject(id);
        if (project) {
          list.push({ id: project.id, name: project.name });
        }
      }
      return Promise.resolve(list);
    },

    // ── Project CRUD ──────────────────────────────────────

    loadProject(id: string): Promise<Project | null> {
      return Promise.resolve(loadProject(id));
    },

    createProject(project: Project, placement?: ProjectPlacement): Promise<void> {
      // Write project data. A refusal (storage full) throws synchronously;
      // callers turn it into a rejection.
      saveProject(project);

      // Add to index (this logic was removed from saveProject in Step 2).
      // v0.19.0 (DASH26 O22): with a placement, the id goes right after its
      // source in the STORED index, so an order another tab wrote survives and
      // an id this browser cannot read stays where it is.
      const index = loadIndex();
      const listed = index.projectIds.includes(project.id);
      if (listed && !placement) return Promise.resolve();
      const projectIds = placement
        ? placeAfter(index.projectIds, [], placement.after, project.id)
        : [...index.projectIds, project.id];
      try {
        saveIndex({ ...index, projectIds });
      } catch (err) {
        // v0.19.0 (DASH26 R1b F7): the project fitted but its index entry did
        // not. Without this the data stayed in storage, listed nowhere, still
        // using the space the refusal says is full.
        if (!listed) removeProjectData(project.id);
        throw err;
      }
      return Promise.resolve();
    },

    saveProject(project: Project): Promise<void> {
      saveProject(project);
      return Promise.resolve();
    },

    deleteProject(id: string): Promise<void> {
      deleteProject(id);
      return Promise.resolve();
    },

    // ── Preferences (always localStorage) ─────────────────

    getActiveProjectId(): string | null {
      // Try the new dedicated key first
      const stored = localStorage.getItem(LS_ACTIVE_PROJECT);
      if (stored) return stored;

      // Migrate from old StorageIndex on first access
      const index = loadIndex();
      if (index.activeProjectId) {
        localStorage.setItem(LS_ACTIVE_PROJECT, index.activeProjectId);
        return index.activeProjectId;
      }

      return null;
    },

    setActiveProjectId(id: string | null): void {
      if (id) {
        localStorage.setItem(LS_ACTIVE_PROJECT, id);
      } else {
        localStorage.removeItem(LS_ACTIVE_PROJECT);
      }
    },

    moveProject(move: ProjectMove): Promise<MoveOutcome> {
      // v0.20.2 (DASH26 R2o, O53a). The index is the list of projects that
      // exist, so a move is made WITHIN the index as read now and nothing else:
      // an id another tab added, or one this browser cannot read, keeps its
      // slot, and an id this tab still lists after another tab deleted it is
      // never written back. Until v0.20.2 the tab's whole list was written,
      // and refused silently whenever it was not exactly the index, so one
      // unreadable id or another tab's new project made every drop do nothing,
      // and another tab's reorder was undone by the next drop here.
      const index = loadIndex();
      const ids = index.projectIds;
      if (!ids.includes(move.draggedId) || !ids.includes(move.targetId)) {
        return Promise.resolve({ kind: 'refused' });
      }
      const next = moveAmongShown(ids, new Set(move.shownIds), move.draggedId, move.targetId);
      if (!next) return Promise.resolve({ kind: 'unchanged' });
      // The guard: the index keeps exactly its ids, none added, dropped or doubled.
      if (!sameIds(next, ids)) return Promise.resolve({ kind: 'refused' });
      try {
        saveIndex({ ...index, projectIds: next });
      } catch {
        return Promise.resolve({ kind: 'failed' });
      }
      return Promise.resolve({ kind: 'written', order: next });
    },

    // ── Tile colour and archive (v0.21.0, DASH26 R2, O56, O63) ──

    getProjectPrefs(): PrefsRead {
      return currentPrefs();
    },

    onProjectPrefsChange(callback: (read: PrefsRead) => void): () => void {
      prefsListeners.add(callback);
      return () => {
        prefsListeners.delete(callback);
      };
    },

    setProjectPref(id, field, value) {
      const written = writeLocalPref(id, field, value);
      if ('refused' in written) return written.refused;
      prefs = { status: 'ready', prefs: written.prefs };
      for (const listener of prefsListeners) listener(prefs);
      return null;
    },

    retryProjectPrefs(): void {},

    // ── Real-time sync (no-op for local) ─────────────────

    onProjectChange(): () => void {
      return () => {};
    },

    onProjectListChange(): () => void {
      return () => {};
    },

    // ── Export / Import ───────────────────────────────────

    exportProject(project: Project): string {
      // Inject _storageRef at export time (Issue 7 — interface contract)
      return exportProject({ ...project, _storageRef: this.workspaceId });
    },

    importProject(json: string): Project | null {
      return importProject(json);
    },

    // ── Lifecycle ─────────────────────────────────────────

    flush(): void {
      // No-op — local saves are synchronous, no pending writes
    },

    cancelPendingSaves(): void {
      // No-op — local saves are synchronous; no pending writes exist.
    },

    // ── Invitations (cloud-only feature) ─────────────────

    async removeCollaborator(_projectId: string, _userId: string): Promise<void> {
      // Sharing is cloud-only; local mode has no member map to mutate.
    },

    async listPendingInvites(_projectId: string): Promise<PendingInvite[]> {
      // Invitations are a cloud-only feature; local mode has no inbox.
      return [];
    },

    async revokeInvite(_tokenId: string): Promise<void> {
      // Cloud-only; local mode silently no-ops.
    },

    async resendInvite(_tokenId: string): Promise<void> {
      // Cloud-only; local mode silently no-ops.
    },
  };
}
