// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { nanoid } from 'nanoid';
import {
  doc,
  getDoc,
  getDocFromCache,
  setDoc,
  deleteDoc,
  deleteField,
  arrayUnion,
  arrayRemove,
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
import type {
  StorageDriver,
  ProjectListItem,
  ProjectMemberRole,
  ProjectPlacement,
  ProjectMove,
  MoveOutcome,
} from './storage-driver';
import {
  PROJECTS_COL,
  SETTINGS_COL,
  stripUndefined,
  appendChangeLogEntry,
} from './firestore-helpers';
import { validateProjectData } from './storage';
import { LS_ACTIVE_PROJECT, DEBOUNCE_CLOUD_MS, SCHEMA_VERSION } from './constants';
import { DATA_VERSION } from './migrations';
import { callRevokeInvite, callResendInvite } from './callables';
import { normalizeUpdatedAt } from './updated-at';
import { placeAfter } from './project-order';
import { moveAmongShown, withStoredSlots } from './order-move';
import { writeProjectPrefs } from './firestore-prefs';
import {
  isRefusedPrefId,
  overCap,
  sanitizeProjectPrefs,
  withPrefField,
  type PrefsRead,
  type ProjectPrefField,
} from './project-prefs';
import { cloudProjectData, cloudText, type CloudSetAsideReport } from './cloud-load-guards';
import { noteCloudSetAside } from './cloud-load-notices';

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
 * `updatedAt` through `normalizeUpdatedAt`, with SPERT® Forecaster's warning
 * (`firestore-converters.ts` at df59b2d) when the stored value carries no
 * recoverable instant. LEAVE AND LOG, never stamp: substituting the current
 * date or `createdAt` would manufacture data with the wrong meaning.
 *
 * v0.18.0 (DASH26 R1a): until then this file deliberately did not log,
 * because the Projects tab's tile rendered the case ("Updated —") and the
 * user already saw it. The tile no longer shows `updatedAt` (DASH26 R7: it
 * shows the latest snapshot's date), so nothing renders the case any more and,
 * by that comment's own reasoning, it is logged here as Forecaster logs it.
 * The message names neither the project nor the value, as this app's other
 * load warnings do (`cloud-load-notices.ts`).
 */
function readUpdatedAt(value: unknown): string | undefined {
  const updatedAt = normalizeUpdatedAt(value);
  if (updatedAt === undefined) {
    console.warn('[SPERT CFD] cloud-load: a project\'s updatedAt carries no recoverable instant; left unset, not stamped');
  }
  return updatedAt;
}

/**
 * Extract a Project from a Firestore document snapshot.
 * Strips cloud-only fields so consumers see the same shape as local mode.
 *
 * v0.16.4: another editor of a shared project can write this document, so
 * name, workflow, snapshots and settings are read through the checks in
 * `cloud-load-guards.ts`, and each metadata field keeps only its own type.
 * A value set aside is passed to `report`; the rest of the project loads.
 */
function mapDocToProject(snap: DocumentSnapshot, report: CloudSetAsideReport = noteCloudSetAside): Project | null {
  if (!snap.exists()) return null;
  const data = snap.data()!;
  return {
    id: snap.id,
    ...cloudProjectData(snap.id, data, report),
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    updatedAt: readUpdatedAt(data.updatedAt),
    _version: typeof data._version === 'string' ? data._version : DATA_VERSION,
    // Preserve fingerprinting fields if present
    ...(typeof data._originRef === 'string' && { _originRef: data._originRef }),
    ...(Array.isArray(data._changeLog) && { _changeLog: data._changeLog }),
    // Preserve cloud metadata for internal use
    ...(typeof data.owner === 'string' && { owner: data.owner }),
    ...(typeof data.members === 'object' && data.members !== null && !Array.isArray(data.members) && { members: data.members }),
    ...(data.schemaVersion !== undefined && { schemaVersion: data.schemaVersion }),
  };
}

const MEMBER_ROLES: readonly ProjectMemberRole[] = ['owner', 'editor', 'viewer'];

/**
 * One project-list entry. v0.16.4: a name that is not text reads as '' and
 * is reported, so one project cannot take the list down for everyone it
 * names; an owner that is not text reads as none.
 *
 * v0.18.0 (DASH26 R1a): also this user's role and the member count, from the
 * same document, so the Projects tab gates Delete, Edit and Share and shows
 * its badges from the list itself, before and without the per-project stats
 * load. A role that is not one of the three reads as none, which the tile
 * treats as "no gate".
 */
function toListItem(id: string, data: Record<string, unknown>, uid: string): ProjectListItem {
  const members = data.members;
  const memberMap =
    typeof members === 'object' && members !== null && !Array.isArray(members)
      ? (members as Record<string, unknown>)
      : undefined;
  const role = memberMap?.[uid];
  return {
    id,
    name: cloudText(data.name, id, 'project-name', noteCloudSetAside),
    owner: typeof data.owner === 'string' ? data.owner : undefined,
    role: MEMBER_ROLES.includes(role as ProjectMemberRole) ? (role as ProjectMemberRole) : undefined,
    memberCount: memberMap ? Object.keys(memberMap).length : undefined,
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

  // Creates whose project setDoc has not settled: projectId → that setDoc.
  //
  // Until a create lands, the server holds no document, and the rule
  // `allow get: if isCfdMember(resource.data)` DENIES any get or listen on it
  // (resource is null). The app reads a new project at once — it becomes the
  // active project, its card loads stats — so without this every such read
  // failed, and the denied listener was taken for a revoked share
  // (QC26 Q01: 10/10 on the emulator against the deployed rules).
  //
  // While a create is in flight, loadProject reads the local cache, which
  // holds the pending write and any save queued behind it (measured 10/10
  // online and offline), and onProjectChange waits for the create to land.
  const inFlightCreates = new Map<string, Promise<void>>();

  /** Build the membership query for this user's projects. */
  function membershipQuery() {
    // ⚠️ This filter's SHAPE is a security boundary, not a convenience.
    // firestore.rules constrains `list` on this collection to
    // members[request.auth.uid] in ['owner', 'editor', 'viewer'], and Firestore
    // permits a list query ONLY when its filter PROVES that constraint. Drop or
    // change this filter and you do not get more rows — you get
    // PERMISSION_DENIED, and no project loads at all.
    // Until 2026-08-19 the rule was `allow list: if isAuth()`, which let any
    // signed-in SPERT user read every project in this collection.
    // ⚠️ The rule and this query are pinned together by
    // rules-tests/project-collections-list.test.ts in the spert-landing-page
    // repo (`npm run test:rules`). That test encodes this query AS WRITTEN and
    // lives in a DIFFERENT repository, so it will NOT fail when you edit this
    // line. Change one, change the other.
    return query(
      collection(db, PROJECTS_COL),
      where(`members.${uid}`, 'in', ['owner', 'editor', 'viewer']),
    );
  }

  /**
   * The last order this driver read or wrote (v0.20.2, DASH26 R2o, O53a):
   * what a move builds on when the stored order cannot be read now (offline),
   * so an offline drop is still written, queued, and sent on reconnect, as
   * before. Null until a read answers: a driver that never read an order
   * writes none. Kept here, not taken from the SDK's cache: offline, a read of
   * a settings document that did not exist rejects instead of answering "no
   * document" (measured, DASH26 R2 pre-flight R05), so a new person's offline
   * drop would write nothing. A read that found no document gives `[]`.
   */
  let lastOrder: string[] | null = null;
  /**
   * Bumped by every whole-order write this driver issues. A read takes its
   * order as `lastOrder` only if no such write was issued while it was in
   * flight: a list snapshot's read that began before a drop and answered
   * after it would otherwise bring back the order the drop replaced.
   */
  let orderWrites = 0;

  /** The order a settings snapshot holds: its string ids, or `[]` with no document or no list. */
  function orderOf(snap: DocumentSnapshot): string[] {
    const order: unknown = snap.exists() ? snap.data().projectOrder : undefined;
    return Array.isArray(order) ? order.filter((x): x is string => typeof x === 'string') : [];
  }

  /** Record what a read issued at write count `seen` answered (see `orderWrites`). */
  function noteRead(order: string[], seen: number): void {
    if (seen === orderWrites) lastOrder = order;
  }

  // ── Tile colour and archive (v0.21.0, DASH26 R2) ─────
  //
  // The person's map, read ONCE with the order (O62): the first settings read
  // that reaches the server makes it `ready` (a missing document is `{}`),
  // and from then on it is the session's truth; list snapshots and reloads
  // re-read the order only, so a change still waiting to be written is never
  // replaced by an older server value (another device's change shows after a
  // reload). A read that fails, or answers from the cache (offline), leaves
  // `failed` (O54: a failed read is not "no settings"), and each later read
  // retries until one succeeds: every list snapshot and reload, and
  // `retryProjectPrefs` (the window's `online` event, the Projects tab
  // mounting; DASH26 §7 answer 1). Measured: a list listener does not fire on
  // reconnect when the list has not changed (pre-flight R09).
  let prefsRead: PrefsRead = { status: 'loading' };
  const prefsListeners = new Set<(read: PrefsRead) => void>();
  // Changes not yet written, one per (id, field), under a timer of their own
  // (never a project save's); the values are read when it fires.
  const pendingPrefs = new Map<string, { id: string; field: ProjectPrefField }>();
  let prefsTimer: ReturnType<typeof setTimeout> | undefined;
  let prefsRetry: Promise<unknown> | null = null;

  function setPrefsRead(next: PrefsRead): void {
    prefsRead = next;
    for (const listener of prefsListeners) listener(next);
  }

  /** What a settings read means for the map: only the first good one counts. */
  function notePrefsRead(snap: DocumentSnapshot | null): void {
    if (prefsRead.status === 'ready') return;
    if (!snap || snap.metadata?.fromCache) {
      if (prefsRead.status !== 'failed') setPrefsRead({ status: 'failed' });
      return;
    }
    setPrefsRead({ status: 'ready', prefs: sanitizeProjectPrefs(snap.exists() ? snap.data().projectPrefs : undefined) });
  }

  /** Send the changes waiting, with the values the map holds now. */
  function writePendingPrefs(): void {
    clearTimeout(prefsTimer);
    prefsTimer = undefined;
    if (pendingPrefs.size === 0 || prefsRead.status !== 'ready') return;
    const changes = [...pendingPrefs.values()];
    pendingPrefs.clear();
    writeProjectPrefs(db, uid, changes, prefsRead.prefs).catch((err) => {
      console.error('setProjectPref: write failed:', (err as { code?: string }).code ?? 'unknown');
    });
  }

  /** Read the user's project order from settings. */
  async function loadProjectOrder(): Promise<string[]> {
    const seen = orderWrites;
    try {
      const snap = await getDoc(doc(db, SETTINGS_COL, uid));
      // Any read that answers, a cached one included (it holds the last
      // server read and this client's own pending writes), is an order read.
      noteRead(orderOf(snap), seen);
      notePrefsRead(snap);
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.projectOrder)) {
          return data.projectOrder as string[];
        }
      }
    } catch {
      // A failed read: no order to sort by (unordered ids sort last), and
      // the map, if not yet read, is `failed`, never "no settings".
      notePrefsRead(null);
    }
    return [];
  }

  /**
   * The stored order, read strictly for a placement (v0.19.0, DASH26 O22 c):
   * null when the read failed or did not reach the server, so the caller skips
   * the placement and never writes an order built on nothing. Unlike
   * loadProjectOrder, which reads a failure as "no order yet" (`[]`) — written
   * whole, that would replace the person's order with one or two ids.
   * A read issued while this client's own order write is pending sees it
   * (measured, DASH26 R1b M2 and D4).
   */
  async function readStoredOrder(): Promise<string[] | null> {
    const seen = orderWrites;
    try {
      const snap = await getDoc(doc(db, SETTINGS_COL, uid));
      if (snap.metadata.fromCache) return null;
      const order = orderOf(snap);
      noteRead(order, seen);
      return order;
    } catch {
      return null;
    }
  }

  // Whole-order writes take turns: positioned creates since v0.19.0 (DASH26
  // R1b F1), and drag-and-drop moves with them since v0.20.2 (DASH26 R2o,
  // O53a). Each reads the order only once the one before it has ISSUED its
  // order write, so the read sees it (a read issued while this client's own
  // write is pending answers with it: measured, DASH26 R2 pre-flight R12).
  // Without this, two clones started together both read the same order and
  // the second write dropped the first copy to the end (measured 3/3,
  // pre-flight D5). A turn ends when the writes are issued, not acked, so an
  // offline write never holds up the next one.
  let orderTurn: Promise<void> = Promise.resolve();

  /** Take the next turn; resolves with the function that ends it. */
  async function takeOrderTurn(): Promise<() => void> {
    const previous = orderTurn;
    let endTurn = () => {};
    orderTurn = new Promise<void>((resolve) => { endTurn = resolve; });
    await previous;
    return endTurn;
  }

  /**
   * Issue a whole-order write and make it this driver's last order. Returns
   * the write itself, settled when the server acknowledges it: offline it is
   * queued, and settles on reconnect.
   */
  function writeWholeOrder(order: string[]): Promise<void> {
    orderWrites++;
    lastOrder = order;
    return setDoc(doc(db, SETTINGS_COL, uid), { projectOrder: order }, { merge: true });
  }

  function logOrderWriteFailure(what: string, err: unknown): void {
    console.error(`${what} failed:`, (err as { code?: string }).code ?? 'unknown');
  }

  /**
   * The project write of a positioned create: after a strict read of the
   * order, the project write and the whole-order write go out in ONE
   * synchronous run (O22 d), so the moment the create resolves, a fresh client
   * reads the copy after its source (measured, pre-flight D1; M3). A failed
   * read skips the order write; the create's arrayUnion append then stands
   * (O22 c). Resolves or rejects with the project write.
   */
  async function placedProjectWrite(
    id: string,
    docData: Record<string, unknown>,
    placement: ProjectPlacement,
  ): Promise<void> {
    const endTurn = await takeOrderTurn();
    let written: Promise<void>;
    try {
      const stored = await readStoredOrder();
      written = setDoc(doc(db, PROJECTS_COL, id), docData);
      if (stored) {
        writeWholeOrder(placeAfter(stored, placement.shownIds, placement.after, id)).catch((err) => {
          logOrderWriteFailure('createProject: placement', err);
        });
      }
    } finally {
      endTurn();
    }
    await written;
  }

  /** Listen to one project doc; a permission-denied error reads as revoked access. */
  function listenToProject(
    id: string,
    callback: (project: Project | null) => void,
  ): () => void {
    // Capture unsubscribe synchronously (onSnapshot returns it before any
    // async error callback can fire).
    let unsubscribe: (() => void) | null = null;
    unsubscribe = onSnapshot(
      doc(db, PROJECTS_COL, id),
      (snap) => {
        // Echo prevention: skip snapshots from our own pending writes
        if (snap.metadata.hasPendingWrites) return;
        callback(mapDocToProject(snap));
      },
      (err) => {
        const code = (err as { code?: string }).code;
        console.error('onProjectChange listener error:', code ?? err);
        if (code === 'permission-denied') {
          // Access to this project was revoked. Unsubscribe the failing
          // listener and notify the UI to remove it from view.
          // onProjectListChange self-recovers (revoked doc falls out of
          // the membership query automatically).
          unsubscribe?.();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('spert:project-access-revoked', {
                detail: { id },
              }),
            );
          }
        }
      },
    );
    return () => { unsubscribe?.(); };
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
        // Re-attach owner from the raw doc so list consumers can
        // compute isOwner without an N+1 round-trip per project
        // (Lessons 38, 49).
        projects.push(toListItem(d.id, data, uid));
      });
      const order = await loadProjectOrder();
      return sortByOrder(projects, order);
    },

    // ── Project CRUD ──────────────────────────────────────

    async loadProject(id: string): Promise<Project | null> {
      const ref = doc(db, PROJECTS_COL, id);
      const creating = inFlightCreates.get(id);
      if (creating) {
        try {
          return mapDocToProject(await getDocFromCache(ref));
        } catch {
          // Not in the cache after all: wait for the create, then ask the
          // server like any other read.
          await creating.catch(() => {});
        }
      }
      const snap = await getDoc(ref);
      return mapDocToProject(snap);
    },

    async createProject(project: Project, placement?: ProjectPlacement): Promise<void> {
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
        schemaVersion: SCHEMA_VERSION,
        // Fingerprinting
        _originRef: uid,
        _changeLog: appendChangeLogEntry(project._changeLog, changeLogEntry),
      });

      // Registered in the same synchronous run as createProject() is called,
      // so a read issued straight after it returns already sees the create.
      // v0.19.0 (DASH26 R1b F3): for a positioned create this covers the order
      // read that comes BEFORE the project write too; a read in that window
      // waits for the create instead of asking the server for a document that
      // does not exist yet, which the rules deny.
      const written = placement
        ? placedProjectWrite(project.id, docData, placement)
        : setDoc(doc(db, PROJECTS_COL, project.id), docData);
      inFlightCreates.set(project.id, written);
      try {
        await written;
      } finally {
        if (inFlightCreates.get(project.id) === written) {
          inFlightCreates.delete(project.id);
        }
      }

      // Append to project order.
      //
      // arrayUnion, not read-then-write: the server applies it to whatever
      // the document holds when the write lands, so two concurrent creates
      // both land instead of one overwriting the other. The old code read
      // the array, appended locally and wrote the whole thing back, and a
      // second create reading the same array dropped one id.
      //
      // arrayUnion appends only values not already present, so it SUBSUMES
      // the `!order.includes()` guard the read used to feed. Do not keep
      // both.
      //
      // setDoc + merge, NOT updateDoc: updateDoc fails on a missing
      // document, and the settings doc legitimately does not exist for a new
      // user. Measured on the emulator: setDoc + merge + arrayUnion on a
      // non-existent doc yields { projectOrder: ["p1"] }.
      //
      // Caught, not thrown: the project already exists once its own write has
      // landed, so createProject settles on that write alone. A refused
      // append (e.g. a settings field the rules do not yet allow) left the UI
      // calling a saved project unsaved and removing its card; a retry then
      // made a duplicate. Without its entry the project sorts last. Awaited
      // still, so callers that await createProject keep the write order.
      //
      // After a positioned create's order write (v0.19.0), this append finds
      // the id already there and changes nothing; it is the fallback when the
      // placement was skipped.
      try {
        await setDoc(
          doc(db, SETTINGS_COL, uid),
          { projectOrder: arrayUnion(project.id) },
          { merge: true },
        );
      } catch (err) {
        console.error(
          'createProject: projectOrder append failed:',
          (err as { code?: string }).code ?? 'unknown',
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
            // C1: mergeFields wholesale-replaces each listed top-level key
            // instead of deep-merging. Prevents ghost fields when settings
            // sub-fields change (e.g., metricsPeriod kind transitions).
            // owner, members, schemaVersion, _originRef, _changeLog are
            // intentionally absent — buildSavePayload never writes them.
            await setDoc(doc(db, PROJECTS_COL, project.id), payload, {
              mergeFields: ['name', 'updatedAt', 'workflow', 'snapshots', 'settings', '_version'],
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

      // Remove from project order. The mirror of createProject's arrayUnion,
      // and measured to match the old `filter(pid => pid !== id)` exactly,
      // including at the doc-absent edge: arrayRemove on a missing document
      // yields [], which is what filtering an empty read gave.
      await setDoc(
        doc(db, SETTINGS_COL, uid),
        { projectOrder: arrayRemove(id) },
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

    async moveProject(move: ProjectMove): Promise<MoveOutcome> {
      // v0.20.2 (DASH26 R2o, O53a). A WHOLE-ARRAY write, built from the order
      // read now, never from a list the tab holds: until v0.20.2 the tab's
      // list was written as given, so a tab left open undid another device's
      // reorder, and a project this tab had not listed yet lost its place
      // (both measured at 3463be9, DASH26 R2 pre-flight). Every stored id
      // this tab does not show keeps its slot; the move is made among the
      // shown ones. A failed read (offline) falls back to the last order this
      // driver read or wrote, so an offline drop is still queued and sent on
      // reconnect; a driver that never read one writes nothing.
      //
      // Still a race with a plain create's arrayUnion (no turn): an append
      // landing between this read and this write leaves the new id out of
      // the order, so it sorts last until the next move or placement writes
      // it in. It is never removed from the list.
      //
      // The turn ends once the write is issued; the outcome waits for the
      // server's acknowledgement (offline: until reconnect), as the whole-list
      // write before it did, and a refused write is `failed`.
      const endTurn = await takeOrderTurn();
      let next: string[] | null;
      let written: Promise<void>;
      let base: string[] | null;
      let issuedAt: number;
      try {
        base = (await readStoredOrder()) ?? lastOrder;
        if (!base) return { kind: 'unread' };
        next = moveAmongShown(
          withStoredSlots(base, move.heldIds),
          new Set(move.shownIds),
          move.draggedId,
          move.targetId,
        );
        if (!next) return { kind: 'unchanged' };
        written = writeWholeOrder(next);
        issuedAt = orderWrites;
      } finally {
        endTurn();
      }
      try {
        await written;
        return { kind: 'written', order: next };
      } catch (err) {
        logOrderWriteFailure('moveProject: order write', err);
        // Not this driver's order after all, unless another write followed it.
        if (orderWrites === issuedAt) lastOrder = base;
        return { kind: 'failed' };
      }
    },

    // ── Tile colour and archive (v0.21.0, DASH26 R2) ─────

    getProjectPrefs(): PrefsRead {
      return prefsRead;
    },

    onProjectPrefsChange(callback: (read: PrefsRead) => void): () => void {
      prefsListeners.add(callback);
      return () => {
        prefsListeners.delete(callback);
      };
    },

    setProjectPref(id, field, value) {
      if (isRefusedPrefId(id)) return 'refused-id';
      if (prefsRead.status !== 'ready') return 'unread';
      if (overCap(prefsRead.prefs, id, value)) return 'cap';
      setPrefsRead({ status: 'ready', prefs: withPrefField(prefsRead.prefs, id, field, value) });
      pendingPrefs.set(JSON.stringify([id, field]), { id, field });
      clearTimeout(prefsTimer);
      prefsTimer = setTimeout(writePendingPrefs, DEBOUNCE_CLOUD_MS);
      return null;
    },

    retryProjectPrefs(): void {
      if (prefsRead.status !== 'failed' || prefsRetry) return;
      prefsRetry = loadProjectOrder().finally(() => {
        prefsRetry = null;
      });
    },

    // ── Real-time sync ───────────────────────────────────

    onProjectChange(
      id: string,
      callback: (project: Project | null) => void,
    ): () => void {
      const creating = inFlightCreates.get(id);
      if (!creating) return listenToProject(id, callback);

      // A listen now would be denied — even one opened offline is denied on
      // reconnect (10/10) — and read as a revoked share. Start once the
      // create lands; never, if it fails.
      let stopped = false;
      let unsubscribe: (() => void) | null = null;
      creating.then(
        () => { if (!stopped) unsubscribe = listenToProject(id, callback); },
        () => {},
      );
      return () => {
        stopped = true;
        unsubscribe?.();
      };
    },

    onProjectListChange(
      callback: (projects: ProjectListItem[]) => void,
    ): () => void {
      // TODO (v0.12.1 investigation flag): the async snapshot callback
      // awaits loadProjectOrder() mid-flight. Rapid back-to-back
      // snapshots — e.g. burst writes from accept-invite or bulk-share
      // — can interleave such that a later snapshot completes before
      // the earlier one's order resolves, applying stale ordering.
      // Likely fixes: a sequence-token guard that drops late-arriving
      // results, or caching `order` at listener-attach time and
      // invalidating only on an explicit moveProject(). Investigate
      // before the next security audit.
      return onSnapshot(
        membershipQuery(),
        async (snap: QuerySnapshot) => {
          // hasPendingWrites at query level is intentional (Issue 8)
          if (snap.metadata.hasPendingWrites) return;
          const projects: ProjectListItem[] = [];
          snap.forEach((d) => {
            const data = d.data();
            // Re-attach owner so the spert:models-changed downstream
            // listeners (and any other list-snapshot consumer) get
            // ownership metadata without a follow-up read (Lesson 49).
            projects.push(toListItem(d.id, data, uid));
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
      writePendingPrefs();
      for (const [id, { timeout, project, resolve }] of pendingWrites) {
        clearTimeout(timeout);
        pendingWrites.delete(id);
        const payload = buildSavePayload(project);
        // Fire-and-forget — best-effort flush before unmount/tab close.
        // Resolve the promise unconditionally because flush() is invoked
        // when the UI cannot respond to rejections (beforeunload, unmount).
        setDoc(doc(db, PROJECTS_COL, project.id), payload, {
          mergeFields: ['name', 'updatedAt', 'workflow', 'snapshots', 'settings', '_version'],
        }).catch(() => {});
        resolve();
      }
    },

    cancelPendingSaves(): void {
      // The colour and archive changes waiting go too (v0.21.0, O55): one made
      // before a sign-out never reaches the next account.
      clearTimeout(prefsTimer);
      prefsTimer = undefined;
      pendingPrefs.clear();
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
