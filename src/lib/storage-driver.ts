// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Project, PendingInvite } from '@/types';

export type StorageMode = 'local' | 'cloud';

export interface ProjectListItem {
  id: string;
  name: string;
  /**
   * Owner UID. Cloud mode populates this from the Firestore document's
   * top-level `owner` field at every list-level read site
   * (loadProjectList, onProjectListChange) so consumers can compute
   * `isOwner` without having to load the full project (Lessons 38, 49).
   * Local mode omits — there is no ownership concept (everything is
   * "yours" by definition).
   */
  owner?: string;
  /**
   * v0.18.0: this user's role on the project, from the document's `members`
   * map, set by cloud mode at the same read sites as `owner`. The membership
   * query lists only projects whose `members[uid]` is one of the three
   * roles. Local mode omits it, as it omits `owner`, so no access gate or
   * badge ever shows there, even on a kept local copy of a cloud project.
   * Absent also on a cloud project this browser is still creating or
   * importing, until the list listener delivers it: the tile reads absent as
   * "no gate" (DASH26 R1a D4), never as "not the owner".
   */
  role?: ProjectMemberRole;
  /** v0.18.0: the number of entries in `members`, cloud mode only (the "Shared" badge, DASH26 R9). */
  memberCount?: number;
}

export type ProjectMemberRole = 'owner' | 'editor' | 'viewer';

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
   * May be debounced internally (200ms cloud; local saves are synchronous).
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

  /**
   * Discard all pending debounced writes without firing them.
   * Use on sign-out to avoid writing with revoked credentials.
   * Contrast with flush(), which fires pending writes; use flush() on
   * beforeunload.
   */
  cancelPendingSaves(): void;

  // ── Invitations (cloud-only feature; local-mode stubs) ──────

  /**
   * Remove a member from a project. Targeted merge update on
   * `members.${userId}` via deleteField() — race-safe vs. a
   * read-modify-write of the whole members map.
   * Local-mode is a no-op stub (sharing is cloud-only).
   */
  removeCollaborator(projectId: string, userId: string): Promise<void>;

  /**
   * List pending invitations for a project owned by the caller. Reads
   * spertsuite_invitations directly via the owner-branch security rule
   * (inviterUid == request.auth.uid). Returns only status === 'pending'.
   * Local-mode returns an empty array.
   *
   * Note: the invitation document's `modelId` field stores CFD's
   * projectId (suite-shared schema keeps the field name stable).
   */
  listPendingInvites(projectId: string): Promise<PendingInvite[]>;

  /**
   * Soft-revoke a pending invitation. Server marks status='revoked'
   * (no delete). Caller must be the inviter. Local-mode is a no-op.
   */
  revokeInvite(tokenId: string): Promise<void>;

  /**
   * Re-send a pending invitation email. Server enforces a hard cap of
   * 5 sends per invitation; bumping past the cap returns
   * resource-exhausted. Caller must be the inviter. Local-mode is a
   * no-op.
   */
  resendInvite(tokenId: string): Promise<void>;
}
