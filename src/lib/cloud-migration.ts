// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Data migration between localStorage and Firestore.
 *
 * migrateLocalToCloud() — uploads local projects to Firestore.
 * Cloud-to-local migration is not supported (cloud is source of truth).
 * Use "Export All" for data portability instead.
 */

import { nanoid } from 'nanoid';
import { doc, getDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { Project, ChangeLogEntry } from '@/types';
import type { StorageDriver } from './storage-driver';
import { PROJECTS_COL } from './firestore-helpers';
import { writeUploadedPref } from './firestore-prefs';
import { projectPrefOf, type ProjectPref, type ProjectPrefs } from './project-prefs';

/**
 * Upload an in-memory list of projects to Firestore.
 *
 * The caller provides the projects array directly (from in-memory state
 * — e.g., useProjectList().projects resolved to full Project objects).
 * This avoids reading raw localStorage at migration time, which prevented
 * a prior user's leftover localStorage data from being silently uploaded
 * to the current user's Firestore account (finding C3).
 *
 * Collision handling (§21.13):
 * - getDoc() wrapped in try/catch because Firestore security rules
 *   referencing resource.data.members throw PERMISSION_DENIED for
 *   non-existent docs (resource.data is null).
 * - If a doc with the same ID exists AND user is a member → skip
 * - If PERMISSION_DENIED or doc doesn't exist → generate new nanoid(8), proceed
 *
 * v0.21.0 (DASH26 R2, O64): each project's tile colour and archive (this
 * browser's map, `localPrefs`) go up right after its create lands, under its
 * cloud id, both fields masked, awaited. A refused colour/archive write never
 * stops the upload: the project is named in `prefsNotCarried`, and the caller
 * switches to Cloud and says so (staying local would make the retry duplicate
 * every project already uploaded: the collision read of a project that does
 * not exist is refused, so every upload mints a new id, measured).
 * `pairs` holds every project that landed, local id → cloud id; a failed
 * create throws an `UploadError` carrying the pairs so far.
 */
export async function migrateLocalToCloud(
  uid: string,
  db: Firestore,
  projects: Project[],
  cloudDriver: StorageDriver,
  localPrefs: ProjectPrefs = {},
): Promise<UploadResult> {
  let uploaded = 0;
  let skipped = 0;
  const pairs: Array<[string, string]> = [];
  const prefsNotCarried: string[] = [];

  for (const project of projects) {
    if (!project) {
      skipped++;
      continue;
    }

    let targetId = project.id;

    // Collision check — try/catch for §21.13 PERMISSION_DENIED pattern
    try {
      const existing = await getDoc(doc(db, PROJECTS_COL, targetId));
      if (existing.exists()) {
        const data = existing.data();
        if (data.members && data.members[uid]) {
          // User already has this project in cloud — skip
          skipped++;
          continue;
        }
        // Belongs to someone else — generate new ID
        targetId = nanoid(8);
      }
    } catch {
      // PERMISSION_DENIED means doc exists but user isn't a member,
      // or doc doesn't exist (rule can't evaluate resource.data).
      // Generate a new ID to avoid collision.
      targetId = nanoid(8);
    }

    // Build the project with the target ID and migration changelog entry
    const changeLogEntry: ChangeLogEntry = {
      action: 'uploaded',
      timestamp: new Date().toISOString(),
      actor: uid,
    };

    const projectToUpload: Project = {
      ...project,
      id: targetId,
      _changeLog: [...(project._changeLog ?? []), changeLogEntry],
    };

    try {
      await cloudDriver.createProject(projectToUpload);
    } catch (err) {
      throw new UploadError(err, pairs);
    }
    uploaded++;
    pairs.push([project.id, targetId]);

    if (!(await carryPref(db, uid, targetId, projectPrefOf(localPrefs, project.id)))) prefsNotCarried.push(project.name);
  }

  return { uploaded, skipped, pairs, prefsNotCarried };
}

/** One project's colour and archive under its cloud id; false when the write was refused (nothing to write is true). */
async function carryPref(db: Firestore, uid: string, cloudId: string, pref: ProjectPref): Promise<boolean> {
  if (!pref.color && !pref.archived) return true;
  try {
    await writeUploadedPref(db, uid, cloudId, pref);
    return true;
  } catch (err) {
    console.error('migrateLocalToCloud: colour/archive not carried:', (err as { code?: string }).code ?? 'unknown');
    return false;
  }
}

export interface UploadResult {
  uploaded: number;
  skipped: number;
  /** Every project that landed: [local id, cloud id]. */
  pairs: Array<[string, string]>;
  /** Projects whose colour or archive could not be written, by name (O64). */
  prefsNotCarried: string[];
}

/** A project's create failed; the upload stopped there. `pairs` are the projects that landed before it. */
export class UploadError extends Error {
  readonly pairs: Array<[string, string]>;
  constructor(cause: unknown, pairs: Array<[string, string]>) {
    super(cause instanceof Error ? cause.message : 'Migration failed');
    this.name = 'UploadError';
    this.pairs = [...pairs];
  }
}

/**
 * Delete all local projects after successful migration.
 * Optional post-upload cleanup — called only if user confirms.
 */
export async function clearLocalProjects(
  localDriver: StorageDriver,
): Promise<void> {
  const list = await localDriver.loadProjectList();
  for (const entry of list) {
    await localDriver.deleteProject(entry.id);
  }
}
