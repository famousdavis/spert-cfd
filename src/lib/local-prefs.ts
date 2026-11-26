// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { LS_PROJECT_PREFS } from './constants';
import { isStorageFullError } from './storage-errors';
import {
  isRefusedPrefId,
  overCap,
  sanitizeProjectPrefs,
  withPrefField,
  type PrefRefusal,
  type PrefValue,
  type ProjectPref,
  type ProjectPrefField,
  type ProjectPrefs,
} from './project-prefs';

/** This browser's map, sanitised; `{}` when the key is absent, unreadable or not a map. */
export function readLocalPrefs(): ProjectPrefs {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_PROJECT_PREFS);
    return raw ? sanitizeProjectPrefs(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

function save(prefs: ProjectPrefs): PrefRefusal | null {
  try {
    if (Object.keys(prefs).length === 0) localStorage.removeItem(LS_PROJECT_PREFS);
    else localStorage.setItem(LS_PROJECT_PREFS, JSON.stringify(prefs));
    return null;
  } catch (err) {
    return isStorageFullError(err) ? 'full' : 'failed';
  }
}

/**
 * One field of one entry, written now (O63): the key is read again and only
 * that field changes, so a change another tab made is kept, never overwritten
 * by a map held in memory. Returns the map written, or why nothing was.
 */
export function writeLocalPref<F extends ProjectPrefField>(
  id: string,
  field: F,
  value: PrefValue<F>,
): { prefs: ProjectPrefs } | { refused: PrefRefusal } {
  if (isRefusedPrefId(id)) return { refused: 'refused-id' };
  const stored = readLocalPrefs();
  if (overCap(stored, id, value)) return { refused: 'cap' };
  const next = withPrefField(stored, id, field, value);
  const refused = save(next);
  return refused ? { refused } : { prefs: next };
}

/**
 * Several whole entries written at once (R36: Keep local copy carries the
 * person's colours and archive for the projects it copied). Each entry
 * replaces that id's local entry; every other entry is kept. Refused ids are
 * skipped; entries past the cap are not added.
 */
export function copyLocalPrefs(entries: ReadonlyArray<readonly [string, ProjectPref]>): { prefs: ProjectPrefs } | { refused: PrefRefusal } {
  let next = readLocalPrefs();
  for (const [id, pref] of entries) {
    if (isRefusedPrefId(id)) continue;
    for (const field of ['color', 'archived'] as const) {
      const value = (field === 'color' ? pref.color : pref.archived) as PrefValue<typeof field>;
      if (overCap(next, id, value)) continue;
      next = withPrefField(next, id, field, value as never);
    }
  }
  const refused = save(next);
  return refused ? { refused } : { prefs: next };
}
