// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { nanoid } from 'nanoid';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  deleteField,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  runTransaction,
  type Firestore,
  type DocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import type { Project, ChangeLogEntry, PendingInvite, InvitationStatus } from '@/types';
import type { StorageDriver, ProjectListItem } from './storage-driver';
import {
  PROJECTS_COL,
  SETTINGS_COL,
  stripUndefined,
  appendChangeLogEntry,
} from './firestore-helpers';
import { validateProjectData } from './storage';
import { LS_ACTIVE_PROJECT, DEBOUNCE_CLOUD_MS } from './constants';
import { DATA_VERSION } from './migrations';
import { callRevokeInvite, callResendInvite } from './callables';

// ── Invitation helpers ──────────────────────────────────

const INVITATIONS_COL = 'spertsuite_invitations';

/**
 * Coerce a Firestore Timestamp (or number, or undefined) into millis.
 * Server-written `createdAt`/`expiresAt` fields land as Timestamp
 * objects; the SDK exposes `.toMillis()` for conversion.
 */
function tsToMillis(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    const fn = (value as { toMillis: () => number }).toMillis;
    if (typeof fn === 'function') return fn.call(value);
  }
  return 0;
}

/**
 * Map a raw spertsuite_invitations Firestore document into the
 * strongly-typed PendingInvite domain object. Defaults match the
 * suite-shared schema — missing string fields fall back to '' or
 * sensible enum values, missing timestamps to 0, missing send count
 * to 0. Caller is responsible for filtering by status === 'pending'.
 */
function mapToPendingInvite(
  id: string,
  d: Record<string, unknown>,
  fallbackProjectId: string,
  callerUid: string,
): PendingInvite {
  return {
    tokenId: id,
    appId: (d['appId'] as string) ?? 'spertcfd',
    modelId: (d['modelId'] as string) ?? fallbackProjectId,
    modelName: (d['modelName'] as string) ?? '',
    inviteeEmail: (d['inviteeEmail'] as string) ?? '',
    role: (d['role'] as PendingInvite['role']) ?? 'editor',
    isVoting: Boolean(d['isVoting']),
    inviterUid: (d['inviterUid'] as string) ?? callerUid,
    inviterName: (d['inviterName'] as string) ?? '',
    inviterEmail: (d['inviterEmail'] as string) ?? '',
    status: (d['status'] as InvitationStatus) ?? 'pending',
    createdAt: tsToMillis(d['createdAt']),
    expiresAt: tsToMillis(d['expiresAt']),
    lastEmailSentAt: tsToMillis(d['lastEmailSentAt']),
    emailSendCount:
      typeof d['emailSendCount'] === 'number'
        ? (d['emailSendCount'] as number)
        : 0,
    updatedAt: tsToMillis(d['updatedAt']),
    ...(d['acceptedAt'] !== undefined ? { acceptedAt: tsToMillis(d['acceptedAt']) } : {}),
    ...(d['acceptedByUid'] !== undefined
      ? { acceptedByUid: d['acceptedByUid'] as string }
      : {}),
  };
}

// ── Internal helpers ────────────────────────────────────

/**
 * Extract a Project from a Firestore document snapshot.
 * Strips cloud-only fields so consumers see the same shape as local mode.
 */
function mapDocToProject(snap: DocumentSnapshot): Project | null {
  if (!snap.exists()) return null;
  const data = snap.data()!;
  return {
    id: snap.id,
    name: data.name,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    workflow: data.workflow ?? [],
    snapshots: data.snapshots ?? [],
    settings: data.settings ?? {
      gridSortNewestFirst: true,
      showWipWarnings: true,
      metricsPeriod: { kind: 'all' },
    },
    _version: data._version ?? DATA_VERSION,
    // Preserve fingerprinting fields if present
    ...(data._originRef !== undefined && { _originRef: data._originRef }),
    ...(data._changeLog !== undefined && { _changeLog: data._changeLog }),
    // Preserve cloud metadata for internal use
    ...(data.owner !== undefined && { owner: data.owner }),
    ...(data.members !== undefined && { members: data.members }),
    ...(data.schemaVersion !== undefined && { schemaVersion: data.schemaVersion }),
  };
}

/**
 * Build the data-only fields for a saveProject write.
 * NEVER includes owner, members, or schemaVersion (§21.9).
 */
function buildSavePayload(project: Project): Record<string, unknown> {
  return stripUndefined({
    name: project.name,
    updatedAt: new Date().toISOString(),
    workflow: project.workflow,
    snapshots: project.snapshots,
    settings: project.settings,
    _version: DATA_VERSION,
  });
}

// ── Factory ─────────────────────────────────────────────

/**
 * Creates a FirestoreDriver for the given authenticated user.
 * All project operations are scoped to projects where the user is a member.
 */
export function createFirestoreDriver(uid: string, db: Firestore): StorageDriver {
  // Debounce map: projectId → { timeout, project, resolve, reject }
  // resolve/reject reference the outer saveProject Promise so it can be
  // terminated from setTimeout, cancelPendingSaves, or supersession.
  const pendingWrites = new Map<
    string,
    {
      timeout: ReturnType<typeof setTimeout>;
      project: Project;
      resolve: () => void;
      reject: (err: unknown) => void;
    }
  >();

  /** Build the membership query for this user's projects. */
  function membershipQuery() {
    return query(
      collection(db, PROJECTS_COL),
      where(`members.${uid}`, 'in', ['owner', 'editor', 'viewer']),
    );
  }

  /** Read the user's project order from settings. */
  async function loadProjectOrder(): Promise<string[]> {
    try {
      const snap = await getDoc(doc(db, SETTINGS_COL, uid));
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.projectOrder)) {
          return data.projectOrder as string[];
        }
      }
    } catch {
      // Settings doc may not exist yet — that's fine
    }
    return [];
  }

  /** Sort projects by saved order, with unordered projects at the end. */
  function sortByOrder(
    projects: ProjectListItem[],
    order: string[],
  ): ProjectListItem[] {
    const orderMap = new Map(order.map((id, idx) => [id, idx]));
    return [...projects].sort((a, b) => {
      const aIdx = orderMap.get(a.id) ?? Infinity;
      const bIdx = orderMap.get(b.id) ?? Infinity;
      return aIdx - bIdx;
    });
  }

  return {
    mode: 'cloud',
    workspaceId: uid,

    // ── List operations ───────────────────────────────────

    async loadProjectList(): Promise<ProjectListItem[]> {
      const snap = await getDocs(membershipQuery());
      const projects: ProjectListItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        projects.push({ id: d.id, name: data.name as string });
      });
      const order = await loadProjectOrder();
      return sortByOrder(projects, order);
    },

    // ── Project CRUD ──────────────────────────────────────

    async loadProject(id: string): Promise<Project | null> {
      const snap = await getDoc(doc(db, PROJECTS_COL, id));
      return mapDocToProject(snap);
    },

    async createProject(project: Project): Promise<void> {
      const now = new Date().toISOString();
      const changeLogEntry: ChangeLogEntry = {
        action: 'created',
        timestamp: now,
        actor: uid,
      };

      const docData = stripUndefined({
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: now,
        workflow: project.workflow,
        snapshots: project.snapshots,
        settings: project.settings,
        _version: DATA_VERSION,
        // Cloud metadata — only set by createProject
        owner: uid,
        members: { [uid]: 'owner' },
        schemaVersion: '0.7.0',
        // Fingerprinting
        _originRef: uid,
        _changeLog: appendChangeLogEntry(project._changeLog, changeLogEntry),
      });

      await setDoc(doc(db, PROJECTS_COL, project.id), docData);

      // Append to project order
      const order = await loadProjectOrder();
      if (!order.includes(project.id)) {
        await setDoc(
          doc(db, SETTINGS_COL, uid),
          { projectOrder: [...order, project.id] },
          { merge: true },
        );
      }
    },

    saveProject(project: Project): Promise<void> {
      // Supersede any existing pending write for this project and
      // resolve its promise — the replacement write now carries the
      // latest data; the earlier caller was fire-and-forget.
      const existing = pendingWrites.get(project.id);
      if (existing) {
        clearTimeout(existing.timeout);
        existing.resolve();
      }

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(async () => {
          pendingWrites.delete(project.id);
          const payload = buildSavePayload(project);
          try {
            await setDoc(doc(db, PROJECTS_COL, project.id), payload, {
              merge: true,
            });
            resolve();
          } catch (err) {
            reject(err);
          }
        }, DEBOUNCE_CLOUD_MS);

        pendingWrites.set(project.id, { timeout, project, resolve, reject });
      });
    },

    async deleteProject(id: string): Promise<void> {
      // Cancel any pending write for this project
      const pending = pendingWrites.get(id);
      if (pending) {
        clearTimeout(pending.timeout);
        pendingWrites.delete(id);
      }

      await deleteDoc(doc(db, PROJECTS_COL, id));

      // Remove from project order
      const order = await loadProjectOrder();
      const updated = order.filter((pid) => pid !== id);
      await setDoc(
        doc(db, SETTINGS_COL, uid),
        { projectOrder: updated },
        { merge: true },
      );
    },

    // ── Preferences (always localStorage) ─────────────────

    getActiveProjectId(): string | null {
      return localStorage.getItem(LS_ACTIVE_PROJECT);
    },

    setActiveProjectId(id: string | null): void {
      if (id) {
        localStorage.setItem(LS_ACTIVE_PROJECT, id);
      } else {
        localStorage.removeItem(LS_ACTIVE_PROJECT);
      }
    },

    async reorderProjects(orderedIds: string[]): Promise<void> {
      await setDoc(
        doc(db, SETTINGS_COL, uid),
        { projectOrder: orderedIds },
        { merge: true },
      );
    },

    // ── Real-time sync ───────────────────────────────────

    onProjectChange(
      id: string,
      callback: (project: Project | null) => void,
    ): () => void {
      return onSnapshot(
        doc(db, PROJECTS_COL, id),
        (snap) => {
          // Echo prevention: skip snapshots from our own pending writes
          if (snap.metadata.hasPendingWrites) return;
          callback(mapDocToProject(snap));
        },
        (err) => {
          console.error(
            'onProjectChange listener error:',
            (err as { code?: string }).code ?? err,
          );
        },
      );
    },

    onProjectListChange(
      callback: (projects: ProjectListItem[]) => void,
    ): () => void {
      return onSnapshot(
        membershipQuery(),
        async (snap: QuerySnapshot) => {
          // hasPendingWrites at query level is intentional (Issue 8)
          if (snap.metadata.hasPendingWrites) return;
          const projects: ProjectListItem[] = [];
          snap.forEach((d) => {
            const data = d.data();
            projects.push({ id: d.id, name: data.name as string });
          });
          const order = await loadProjectOrder();
          callback(sortByOrder(projects, order));
        },
        (err) => {
          console.error(
            'onProjectListChange listener error:',
            (err as { code?: string }).code ?? err,
          );
        },
      );
    },

    // ── Export / Import ───────────────────────────────────

    exportProject(project: Project): string {
      // Strip cloud-only fields, inject _storageRef
      const { owner, members, schemaVersion, _originRef, _changeLog, ...data } =
        project;
      return JSON.stringify({ ...data, _storageRef: uid }, null, 2);
    },

    importProject(json: string): Project | null {
      try {
        const data = JSON.parse(json);
        if (!validateProjectData(data)) return null;

        const imported: Project = {
          id: nanoid(8),
          name: data.name,
          createdAt: data.createdAt,
          updatedAt: new Date().toISOString(),
          workflow: data.workflow,
          snapshots: data.snapshots,
          settings: data.settings,
          _version: DATA_VERSION,
        };
        return imported;
      } catch {
        return null;
      }
    },

    // ── Lifecycle ─────────────────────────────────────────

    flush(): void {
      for (const [id, { timeout, project, resolve }] of pendingWrites) {
        clearTimeout(timeout);
        pendingWrites.delete(id);
        const payload = buildSavePayload(project);
        // Fire-and-forget — best-effort flush before unmount/tab close.
        // Resolve the promise unconditionally because flush() is invoked
        // when the UI cannot respond to rejections (beforeunload, unmount).
        setDoc(doc(db, PROJECTS_COL, project.id), payload, {
          merge: true,
        }).catch(() => {});
        resolve();
      }
    },

    cancelPendingSaves(): void {
      // Discard pending debounced writes without firing them. Used on
      // sign-out to avoid setDoc with revoked credentials. Resolve (not
      // reject) outstanding promises so fire-and-forget callers are not
      // broken; they were awaiting coalesced writes that are now moot.
      for (const { timeout, resolve } of pendingWrites.values()) {
        clearTimeout(timeout);
        resolve();
      }
      pendingWrites.clear();
    },

    // ── Invitations (suite-wide) ─────────────────────────

    /**
     * Remove a member from a project. Wrapped in `runTransaction` with
     * three semantic guards (Lesson 50, ARCHITECTURE.md):
     *
     *   1. Pre-tx fast-fail — caller cannot remove themselves. Owners
     *      who self-remove orphan the project; non-owners hit guard 3
     *      anyway, but failing fast saves a Firestore round-trip.
     *   2. In-tx — caller must be the project owner. Firestore rules
     *      enforce this server-side, but the client-side guard surfaces
     *      a meaningful error string instead of an opaque
     *      `permission-denied`.
     *   3. In-tx — owner cannot be removed via this API. The owner
     *      field is the source of truth for ownership; removing the
     *      owner row from `members` while leaving `owner` intact would
     *      corrupt schema invariants (Shape B: owner duplicated in
     *      members with role 'owner').
     *
     * The previous implementation used a bare `updateDoc` with
     * `deleteField()`. That call is field-write atomic, but atomicity
     * does not protect the *semantic* invariants above — a non-owner
     * could submit a request that Firestore rules would block at the
     * server, but the UI saw a generic SDK error rather than a
     * domain-meaningful message.
     *
     * Errors are plain `Error` objects so the UI can surface
     * `err.message` directly without routing through
     * `mapInvitationError` (which is reserved for Firebase Functions
     * error mapping).
     */
    async removeCollaborator(projectId: string, userId: string): Promise<void> {
      if (userId === uid) {
        throw new Error('Cannot remove yourself from a project.');
      }
      const ref = doc(db, PROJECTS_COL, projectId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) {
          throw new Error('Project not found.');
        }
        const data = snap.data() as { owner?: string };
        if (data.owner !== uid) {
          throw new Error('Only the project owner can remove members.');
        }
        if (data.owner === userId) {
          throw new Error('Cannot remove the project owner.');
        }
        tx.update(ref, {
          [`members.${userId}`]: deleteField(),
          updatedAt: new Date().toISOString(),
        });
      });
    },

    /**
     * List pending invitations for a project. Reads
     * spertsuite_invitations directly via the owner-branch security
     * rule (inviterUid == request.auth.uid). The invitation doc's
     * `modelId` field stores CFD's projectId. Uses the deployed
     * (inviterUid, modelId, createdAt) composite index. Filters
     * status === 'pending' in code (cheaper than a third where).
     */
    async listPendingInvites(projectId: string): Promise<PendingInvite[]> {
      const q = query(
        collection(db, INVITATIONS_COL),
        where('inviterUid', '==', uid),
        where('modelId', '==', projectId),
      );
      const snap = await getDocs(q);
      const out: PendingInvite[] = [];
      snap.forEach((s) => {
        const d = s.data() as Record<string, unknown>;
        if (d['status'] !== 'pending') return;
        out.push(mapToPendingInvite(s.id, d, projectId, uid));
      });
      out.sort((a, b) => b.createdAt - a.createdAt);
      return out;
    },

    /**
     * Soft-revoke a pending invitation via the revokeInvite Cloud
     * Function. Server flips status='revoked' (no delete). Errors
     * propagate as Firebase HttpsError; SharingModal's
     * mapInvitationError translates them to user-facing copy.
     */
    async revokeInvite(tokenId: string): Promise<void> {
      await callRevokeInvite(tokenId);
    },

    /**
     * Re-send a pending invitation via the resendInvite Cloud
     * Function. Server enforces emailSendCount <= 5; HttpsError
     * 'resource-exhausted' is mapped to cap copy by the UI.
     */
    async resendInvite(tokenId: string): Promise<void> {
      await callResendInvite(tokenId);
    },
  };
}
