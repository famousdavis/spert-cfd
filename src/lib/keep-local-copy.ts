// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { ProjectListItem, StorageDriver } from './storage-driver';
import { createLocalStorageDriver } from './local-storage-driver';
import { copyLocalPrefs } from './local-prefs';
import { isRefusedPrefId, projectPrefOf, type ProjectPref } from './project-prefs';

/**
 * "Keep local copy" at a switch from Cloud to local (`StorageSection` and the
 * Cloud Storage window; one body since v0.21.0). Every listed project is
 * copied into this browser under its cloud id: the full list, archived ones
 * included (DASH26 O61). A project that cannot be read or saved is skipped
 * and logged, as before.
 *
 * v0.21.0 (DASH26 R36): the person's tile colours and archive for the
 * projects copied come too, into this browser's map, before the switch; the
 * ids are the same, so the copy is exact: each copied id's local entry
 * becomes its cloud entry, an empty one included, which clears whatever an
 * earlier copy left there (PR #115 review, Opus-PR115-1 -02). Entries for
 * ids not copied are kept. Nothing is copied when the cloud map was never
 * read (O54): an unread map is not an empty one.
 */
export async function keepLocalCopy(projects: ProjectListItem[], cloudDriver: StorageDriver): Promise<{ copied: string[] }> {
  const localDriver = createLocalStorageDriver();
  const copied: string[] = [];
  for (const p of projects) {
    try {
      const full = await cloudDriver.loadProject(p.id);
      if (full) {
        await localDriver.createProject(full);
        copied.push(full.id);
      }
    } catch (err) {
      console.error('Failed to copy project to local storage:', (err as { code?: string }).code ?? 'unknown');
    }
  }
  copyPrefsOf(copied, cloudDriver);
  return { copied };
}

/** The person's cloud colours and archive for `ids`, into this browser's map (R36). */
function copyPrefsOf(ids: string[], cloudDriver: StorageDriver): void {
  const read = cloudDriver.getProjectPrefs();
  if (read.status !== 'ready') return;
  const entries: Array<[string, ProjectPref]> = ids
    .filter((id) => !isRefusedPrefId(id))
    .map((id): [string, ProjectPref] => [id, projectPrefOf(read.prefs, id)]);
  if (entries.length === 0) return;
  const result = copyLocalPrefs(entries);
  if ('refused' in result) console.error('Keep local copy: colours and archive not copied:', result.refused);
}
