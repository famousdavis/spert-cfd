// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { doc, setDoc, deleteField, FieldPath, type Firestore } from 'firebase/firestore';
import { SETTINGS_COL } from './firestore-helpers';
import { isRefusedPrefId, projectPrefOf, type ProjectPref, type ProjectPrefField, type ProjectPrefs } from './project-prefs';

/**
 * The write of tile colours and archive to `spertcfd_settings/{uid}` (v0.21.0,
 * DASH26 R2, O52), shared by the cloud driver and the upload.
 *
 * ⚠️ One `FieldPath('projectPrefs', id, field)` per (project id, field), with
 * `deleteField()` for a field being cleared, and a payload built here from the
 * changed entries only. Never:
 * - through `stripUndefined` or any sanitiser that rebuilds objects: it turns
 *   `deleteField()` into a stored map `{ _methodName: 'deleteField' }`;
 * - `null` for a cleared field: it is stored as `null`;
 * - a mask on the entry (`projectPrefs.<id>`): clearing `archived` that way
 *   empties the entry and takes the colour with it;
 * - a mask on the map (`projectPrefs`): it replaces every other entry;
 * - a dotted string: an imported id holding a dot throws, or nests.
 * All five measured on the emulator under the deployed rules (DASH26 R2
 * pre-flight, `shapes.json`). The SDK also throws on a masked field missing
 * from the payload and silently drops a `deleteField()` outside the mask, so
 * every masked path gets a value or `deleteField()`. Nothing else goes in the
 * document: the rules allow only `projectOrder` and `projectPrefs` (O41).
 * Emptying both fields leaves `{}` under the id, which reads as no entry.
 */
export function buildProjectPrefsWrite(
  changes: ReadonlyArray<{ id: string; field: ProjectPrefField }>,
  prefs: ProjectPrefs,
): { payload: { projectPrefs: Record<string, Record<string, unknown>> }; mask: FieldPath[] } {
  const entries = new Map<string, Record<string, unknown>>();
  const mask: FieldPath[] = [];
  const seen = new Set<string>();
  for (const { id, field } of changes) {
    if (isRefusedPrefId(id)) continue;
    const key = JSON.stringify([id, field]);
    if (seen.has(key)) continue;
    seen.add(key);
    const value = projectPrefOf(prefs, id)[field];
    const entry = entries.get(id) ?? {};
    entry[field] = value === undefined ? deleteField() : value;
    entries.set(id, entry);
    mask.push(new FieldPath('projectPrefs', id, field));
  }
  const projectPrefs: Record<string, Record<string, unknown>> = {};
  for (const [id, entry] of entries) {
    Object.defineProperty(projectPrefs, id, { value: entry, enumerable: true, writable: true, configurable: true });
  }
  return { payload: { projectPrefs }, mask };
}

/** Write these changes now. Resolves when the server has them; rejects when refused. Nothing to write resolves at once. */
export async function writeProjectPrefs(
  db: Firestore,
  uid: string,
  changes: ReadonlyArray<{ id: string; field: ProjectPrefField }>,
  prefs: ProjectPrefs,
): Promise<void> {
  const { payload, mask } = buildProjectPrefsWrite(changes, prefs);
  if (mask.length === 0) return;
  await setDoc(doc(db, SETTINGS_COL, uid), payload, { mergeFields: mask });
}

/**
 * The upload's write for one project (O64): both fields masked under its cloud
 * id, a field the local entry lacks cleared, immediate and awaited, so a
 * refusal reaches the upload. An id with no local entry writes both
 * `deleteField()`, which creates no entry (measured).
 */
export function writeUploadedPref(db: Firestore, uid: string, cloudId: string, pref: ProjectPref): Promise<void> {
  const prefs: ProjectPrefs = {};
  if (pref.color || pref.archived) {
    Object.defineProperty(prefs, cloudId, { value: pref, enumerable: true, writable: true, configurable: true });
  }
  return writeProjectPrefs(db, uid, [{ id: cloudId, field: 'color' }, { id: cloudId, field: 'archived' }], prefs);
}
