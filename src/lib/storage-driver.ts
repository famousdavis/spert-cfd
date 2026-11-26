// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Project, PendingInvite } from '@/types';
import type { PrefRefusal, PrefsRead, PrefValue, ProjectPrefField } from './project-prefs';

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
   * v0.19.0 (DASH26 O23, amended after PR #109 review -08): a project this
   * browser creates (Clone, Create, Load Sample) is listed as the person's
   * own, `'owner'` with one member, by ProjectListContext once its create has
   * landed (createProject resolved); the list listener never delivers this
   * device's own create (measured, DASH26 R1b M1). Absent while the create is
   * in flight, when the document may not exist on the server yet, and on a
   * cloud project this browser is importing, until a list read: the tile reads
   * absent as "no gate" (DASH26 R1a D4), never as "not the owner".
   */
  role?: ProjectMemberRole;
  /** v0.18.0: the number of entries in `members`, cloud mode only (the "Shared" badge, DASH26 R9). */
  memberCount?: number;
}

export type ProjectMemberRole = 'owner' | 'editor' | 'viewer';

/**
 * Where a new project goes in the person's stored order (v0.19.0, DASH26
 * O22): right after `after`. `shownIds` is the list on screen, read only when
 * `after` is not in the stored order (see `placeAfter`, `project-order.ts`).
 */
export interface ProjectPlacement {
  after: string;
  shownIds: readonly string[];
}

/**
 * A drag-and-drop move (v0.20.2, DASH26 R2o, O53a): `draggedId` dropped on
 * `targetId`'s tile. Never a final list: the driver applies the move to the
 * order it reads at the time (see `order-move.ts`), so another tab's or
 * device's order survives. `shownIds` are the tiles on screen, among which the
 * move is made; every other stored id keeps its slot. `heldIds` are every
 * project this tab lists (the shown ones and, from v0.21.0, the hidden ones).
 */
export interface ProjectMove {
  draggedId: string;
  targetId: string;
  shownIds: readonly string[];
  heldIds: readonly string[];
}

/**
 * What a move did. `written` carries the whole order written. `unchanged`:
 * the move changed nothing in the order read. `refused` (local): the stored
 * index lacks one of the two ids, so nothing is written. `unread` (cloud): no
 * order could be read and this driver never read one, so nothing is written.
 * `failed`: the local index write threw, or the server refused the cloud
 * write. On every outcome but `written` the screen shows the order it had
 * before the drop. A cloud outcome waits for the server's acknowledgement, so
 * an offline drop's settles on reconnect.
 */
export type MoveOutcome =
  | { kind: 'written'; order: string[] }
  | { kind: 'unchanged' }
  | { kind: 'refused' }
  | { kind: 'unread' }
  | { kind: 'failed' };

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
   *
   * v0.19.0 (DASH26 O22): with `placement`, the project is placed right after
   * `placement.after` in the STORED order, which is read at the time, so an
   * order written elsewhere survives; only the new id moves. Without it, the
   * new id is appended, as before. Local: one index write with the id in
   * place; unreadable ids stay where they are. Cloud: a strict read of the
   * order, then the project write and the whole-order write in one
   * synchronous run; a failed read skips the placement (the append stands).
   */
  createProject(project: Project, placement?: ProjectPlacement): Promise<void>;

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
   * Persist a drag-and-drop move (v0.20.2, DASH26 R2o, O53a; replaces
   * `reorderProjects(orderedIds)`, which wrote whatever list it was given).
   * Local: reads the index fresh and moves within it only; the ids written are
   * exactly the index's, so no project is ever added to or dropped from the
   * list. Cloud: reads `spertcfd_settings/{uid}.projectOrder` from the server,
   * or, when that read fails, takes the last order this driver read or wrote;
   * writes the whole order, taking turns with positioned creates.
   */
  moveProject(move: ProjectMove): Promise<MoveOutcome>;

  // ── Tile colour and archive: each person's own (v0.21.0, DASH26 R2) ──

  /**
   * The person's map now. Local: `ready` at once, from this browser's key.
   * Cloud: `loading` until the first read of `spertcfd_settings/{uid}` that
   * reaches the server (with the order, when the list loads); then `ready`,
   * and that map is the session's truth: later reads touch only the order
   * (O62). A read that fails leaves `failed`, retried at each list snapshot
   * and by `retryProjectPrefs` until one succeeds (O54).
   */
  getProjectPrefs(): PrefsRead;

  /** Called with the map whenever it changes. */
  onProjectPrefsChange(callback: (read: PrefsRead) => void): () => void;

  /**
   * Change one field of one project's entry; null when made, else why not.
   * Local: written now, the key read again first (O63). Cloud: in memory at
   * once, then written per field (`mergeFields`, `deleteField()` to clear,
   * O52) after a 200 ms debounce under its own timer, the values read when it
   * fires; `flush()` sends it, `cancelPendingSaves()` drops it. Refused while
   * the map is not `ready`, for a refused id, and past the cap.
   */
  setProjectPref<F extends ProjectPrefField>(id: string, field: F, value: PrefValue<F>): PrefRefusal | null;

  /**
   * Called when a change `setProjectPref` took was refused later, by the
   * server (PR #115 review, Opus-PR115-2 -09). Cloud: the write goes after the
   * debounce, so a refusal comes after the change showed; the map is then put
   * back from a fresh read of the person's settings (changes still waiting or
   * on their way kept), or `failed` when that read fails too, and each
   * listener is called once. A refusal no listener heard is told to the next
   * one that subscribes. Local: never (its refusals are returned at once).
   */
  onProjectPrefsRefused(callback: () => void): () => void;

  /** Read the person's settings again if the last read failed (O54, DASH26 §7 answer 1). Local: nothing. */
  retryProjectPrefs(): void;

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
