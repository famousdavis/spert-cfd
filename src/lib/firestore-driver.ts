// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { nanoid } from 'nanoid';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  type Firestore,
  type DocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import type { Project, ChangeLogEntry } from '@/types';
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
      return onSnapshot(doc(db, PROJECTS_COL, id), (snap) => {
        // Echo prevention: skip snapshots from our own pending writes
        if (snap.metadata.hasPendingWrites) return;
        callback(mapDocToProject(snap));
      });
    },

    onProjectListChange(
      callback: (projects: ProjectListItem[]) => void,
    ): () => void {
      return onSnapshot(membershipQuery(), async (snap: QuerySnapshot) => {
        // hasPendingWrites at query level is intentional (Issue 8)
        if (snap.metadata.hasPendingWrites) return;
        const projects: ProjectListItem[] = [];
        snap.forEach((d) => {
          const data = d.data();
          projects.push({ id: d.id, name: data.name as string });
        });
        const order = await loadProjectOrder();
        callback(sortByOrder(projects, order));
      });
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
  };
}
