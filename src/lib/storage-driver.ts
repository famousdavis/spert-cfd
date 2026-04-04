// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Project } from '@/types';

export type StorageMode = 'local' | 'cloud';

export interface ProjectListItem {
  id: string;
  name: string;
}

export interface StorageDriver {
  /** Current storage mode. */
  readonly mode: StorageMode;

  /** Workspace identifier: nanoid for local, Firebase UID for cloud. */
  readonly workspaceId: string;

  // ── List operations ───────────────────────────────────

  /** Load all projects the current user can access. Returns {id, name} pairs. */
  loadProjectList(): Promise<ProjectListItem[]>;

  // ── Project CRUD ──────────────────────────────────────

  /** Load a full project by ID. Returns null if not found. */
  loadProject(id: string): Promise<Project | null>;

  /**
   * Create a new project.
   * In cloud mode, this sets owner/members fields.
   * In local mode, this adds the project ID to the index.
   */
  createProject(project: Project): Promise<void>;

  /**
   * Save an existing project (data fields only).
   * In cloud mode, uses merge:true and NEVER touches owner/members.
   * May be debounced internally (300ms local, 500ms cloud).
   */
  saveProject(project: Project): Promise<void>;

  /** Delete a project by ID. */
  deleteProject(id: string): Promise<void>;

  // ── Preferences (always localStorage) ─────────────────

  /** Get the persisted active project ID. */
  getActiveProjectId(): string | null;

  /** Set the active project ID. */
  setActiveProjectId(id: string | null): void;

  /**
   * Persist project display order.
   * Local: updates StorageIndex.projectIds.
   * Cloud: writes to spertcfd_settings/{uid}.projectOrder.
   */
  reorderProjects(orderedIds: string[]): Promise<void>;

  // ── Real-time sync (cloud only) ───────────────────────

  /**
   * Subscribe to changes on a specific project.
   * Local: returns no-op unsubscribe.
   * Cloud: uses onSnapshot with hasPendingWrites echo prevention.
   */
  onProjectChange(
    id: string,
    callback: (project: Project | null) => void,
  ): () => void;

  /**
   * Subscribe to changes in the project list.
   * Local: returns no-op unsubscribe.
   * Cloud: uses onSnapshot on the membership query.
   */
  onProjectListChange(
    callback: (projects: ProjectListItem[]) => void,
  ): () => void;

  // ── Export / Import ───────────────────────────────────

  /**
   * Serialize a project for JSON export.
   * Cloud: strips owner, members, schemaVersion.
   * Both: injects _storageRef.
   */
  exportProject(project: Project): string;

  /**
   * Parse and validate imported JSON, returning a Project with a new ID.
   * Returns null if validation fails.
   */
  importProject(json: string): Project | null;

  // ── Lifecycle ─────────────────────────────────────────

  /** Flush any pending debounced writes immediately. */
  flush(): void;
}
