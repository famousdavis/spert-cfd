// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { nanoid } from 'nanoid';
import type { Project } from '@/types';
import type { StorageDriver, ProjectListItem } from './storage-driver';
import {
  loadIndex,
  saveIndex,
  loadProject,
  saveProject,
  deleteProject,
  exportProject,
  importProject,
} from './storage';
import { LS_ACTIVE_PROJECT, LS_WORKSPACE_ID } from './constants';

/**
 * Creates a LocalStorageDriver wrapping existing storage.ts functions
 * behind the async StorageDriver interface.
 *
 * All operations resolve immediately (localStorage is synchronous).
 */
export function createLocalStorageDriver(): StorageDriver {
  let cachedWorkspaceId: string | null = null;

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

    createProject(project: Project): Promise<void> {
      // Write project data
      saveProject(project);

      // Add to index (this logic was removed from saveProject in Step 2)
      const index = loadIndex();
      if (!index.projectIds.includes(project.id)) {
        index.projectIds.push(project.id);
        saveIndex(index);
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

    reorderProjects(orderedIds: string[]): Promise<void> {
      const index = loadIndex();

      // Validate: must be a permutation of existing projectIds
      if (
        orderedIds.length !== index.projectIds.length ||
        new Set(orderedIds).size !== orderedIds.length ||
        !orderedIds.every((id) => index.projectIds.includes(id))
      ) {
        return Promise.resolve(); // Reject silently
      }

      saveIndex({ ...index, projectIds: orderedIds });
      return Promise.resolve();
    },

    // ── Real-time sync (no-op for local) ─────────────────

    onProjectChange(): () => void {
      return () => {};
    },

    onProjectListChange(): () => void {
      return () => {};
    },

    // ── Export / Import ───────────────────────────────────

    exportProject(project: Project): string {
      return exportProject(project);
    },

    importProject(json: string): Project | null {
      return importProject(json);
    },

    // ── Lifecycle ─────────────────────────────────────────

    flush(): void {
      // No-op — local saves are synchronous, no pending writes
    },
  };
}
