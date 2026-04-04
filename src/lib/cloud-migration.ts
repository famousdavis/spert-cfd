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

/**
 * Upload all local projects to Firestore.
 *
 * Collision handling (§21.13):
 * - getDoc() wrapped in try/catch because Firestore security rules
 *   referencing resource.data.members throw PERMISSION_DENIED for
 *   non-existent docs (resource.data is null).
 * - If a doc with the same ID exists AND user is a member → skip
 * - If PERMISSION_DENIED or doc doesn't exist → generate new nanoid(8), proceed
 *
 * Local data is left in place as a backup.
 *
 * @returns {{ uploaded: number, skipped: number }}
 */
export async function migrateLocalToCloud(
  uid: string,
  db: Firestore,
  localDriver: StorageDriver,
  cloudDriver: StorageDriver,
): Promise<{ uploaded: number; skipped: number }> {
  const localProjects = await localDriver.loadProjectList();
  let uploaded = 0;
  let skipped = 0;

  for (const entry of localProjects) {
    const project = await localDriver.loadProject(entry.id);
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

    await cloudDriver.createProject(projectToUpload);
    uploaded++;
  }

  return { uploaded, skipped };
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
