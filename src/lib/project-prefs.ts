// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Each person's own tile colour and archive, per project (v0.21.0, DASH26 R2,
 * O50): SPERT® Forecaster's data at df59b2d (`src/shared/lib/project-prefs.ts`),
 * with SPERT® Story Map's id rule (O60). Stored in the person's settings, never
 * on the project: in Cloud Storage `spertcfd_settings/{uid}.projectPrefs`, in
 * local mode this browser's `spertcfd-project-prefs` (O56). Pure: no storage.
 *
 * An entry is `{ color?, archived?: true }`; no colour is the field absent and
 * `archived` is `true` or absent. Nothing prunes: an entry for a project that
 * no longer exists is harmless and kept.
 */

export type ProjectColor = 'blue' | 'teal' | 'slate' | 'purple' | 'pink';

export interface ProjectPref {
  color?: ProjectColor;
  archived?: true;
}

/** Keyed by project id. Built with own properties only (see `isRefusedPrefId`). */
export type ProjectPrefs = Record<string, ProjectPref>;

/** The two fields of an entry, as the cloud write names them. */
export type ProjectPrefField = 'color' | 'archived';
export const PREF_FIELDS: readonly ProjectPrefField[] = ['color', 'archived'];

export const PROJECT_COLORS: readonly ProjectColor[] = ['blue', 'teal', 'slate', 'purple', 'pink'];

/** Far more than anyone holds: a bound on what a tampered store or document can add (Story Map PF-08 says so on screen). */
export const MAX_PROJECT_PREFS = 1000;

/**
 * An id that is never a key, on read, on write and in the controls (O60;
 * Story Map's `isRefusedSegment`): not a string, empty, `__…__` (the
 * Firestore SDK refuses such a field name), or the name of ANY
 * `Object.prototype` member. Measured on the emulator (DASH26 R2 pre-flight):
 * an entry at `projectPrefs.hasOwnProperty` kills every client that next
 * compares two versions of the document (`INTERNAL ASSERTION FAILED (ID:
 * b815)`); `__proto__`, `__x__` and `''` cannot be written at all.
 * SPERT® Forecaster's narrower rule lets `hasOwnProperty` through.
 */
export function isRefusedPrefId(id: unknown): boolean {
  return typeof id !== 'string' || id === '' || /^__.*__$/.test(id) || id in Object.prototype;
}

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Set `key` on `o` as an own, enumerable property (never through a setter on the prototype). */
function setOwn<T>(o: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(o, key, { value, enumerable: true, writable: true, configurable: true });
}

/** Each field on its own, then the entry: a refused colour leaves a valid archive; `{}` reads as no entry. */
function sanitizeEntry(raw: unknown): ProjectPref | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { color, archived } = raw as { color?: unknown; archived?: unknown };
  const pref: ProjectPref = {};
  if (PROJECT_COLORS.includes(color as ProjectColor)) pref.color = color as ProjectColor;
  if (archived === true) pref.archived = true;
  return pref.color || pref.archived ? pref : null;
}

/**
 * The map as stored, kept only where it can be trusted (a local key or a cloud
 * document). Never throws; `{}` when nothing is left. Stops once 1,000 entries
 * are kept; refused keys use no place.
 */
export function sanitizeProjectPrefs(raw: unknown): ProjectPrefs {
  const out: ProjectPrefs = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  let kept = 0;
  for (const key of Object.keys(raw)) {
    if (kept >= MAX_PROJECT_PREFS) break;
    if (isRefusedPrefId(key)) continue;
    const pref = sanitizeEntry((raw as Record<string, unknown>)[key]);
    if (!pref) continue;
    setOwn(out, key, pref);
    kept++;
  }
  return out;
}

/** This project's entry, or an empty one (own properties only). */
export function projectPrefOf(prefs: ProjectPrefs | undefined, id: string): ProjectPref {
  return prefs !== undefined && own(prefs, id) ? prefs[id] : {};
}

export function isProjectArchived(prefs: ProjectPrefs | undefined, id: string): boolean {
  return projectPrefOf(prefs, id).archived === true;
}

/** The projects this person sees: everything, or everything not archived. Never reorders. */
export function shownProjects<P extends { id: string }>(projects: P[], prefs: ProjectPrefs | undefined, showArchived: boolean): P[] {
  return showArchived ? projects : projects.filter((p) => !isProjectArchived(prefs, p.id));
}

/** The value a field takes: a colour, `true`, or undefined (cleared). */
export type PrefValue<F extends ProjectPrefField> = F extends 'color' ? ProjectColor | undefined : true | undefined;

/** `prefs` with one field of `id`'s entry changed (an emptied entry is removed). A new object; `prefs` is untouched. */
export function withPrefField<F extends ProjectPrefField>(prefs: ProjectPrefs, id: string, field: F, value: PrefValue<F>): ProjectPrefs {
  const out: ProjectPrefs = {};
  for (const key of Object.keys(prefs)) if (key !== id) setOwn(out, key, prefs[key]);
  const entry: ProjectPref = { ...projectPrefOf(prefs, id) };
  if (field === 'color') {
    if (value === undefined) delete entry.color;
    else entry.color = value as ProjectColor;
  } else if (value === undefined) {
    delete entry.archived;
  } else {
    entry.archived = true;
  }
  if (entry.color || entry.archived) setOwn(out, id, entry);
  return out;
}

/** Whether a change to `id` needs a new entry while the map already holds the most it may (O63). */
export function overCap(prefs: ProjectPrefs, id: string, value: unknown): boolean {
  return value !== undefined && !own(prefs, id) && Object.keys(prefs).length >= MAX_PROJECT_PREFS;
}

/**
 * Why a colour or archive change was not made. `refused-id`: the project's id
 * is one no entry may have (O60). `cap`: the map already holds 1,000 entries
 * (O63). `full`: this browser's storage is full (R25's words). `unread`: the
 * person's settings have not been read yet (O54). `failed`: anything else.
 */
export type PrefRefusal = 'refused-id' | 'cap' | 'full' | 'unread' | 'failed';

/**
 * The person's map as a driver holds it (O54, O62): `loading` until the first
 * read of their settings answers; `ready` once one has (a missing document is
 * `{}`); `failed` when it could not be read, until a later read succeeds.
 */
export type PrefsRead =
  | { status: 'loading' }
  | { status: 'ready'; prefs: ProjectPrefs }
  | { status: 'failed' };
