// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { ChangeLogEntry } from '@/types';

// ── Collection names ────────────────────────────────────

export const PROJECTS_COL = 'spertcfd_projects';
export const SETTINGS_COL = 'spertcfd_settings';
export const PROFILES_COL = 'spertcfd_profiles';

// ── Changelog cap ───────────────────────────────────────

const MAX_CHANGELOG_ENTRIES = 50;

// ── Helpers ─────────────────────────────────────────────

/**
 * Recursively removes keys with `undefined` values from an object.
 * Firestore rejects explicit `undefined` values (§21.4).
 */
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => stripUndefined(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value !== undefined) {
      result[key] = typeof value === 'object' && value !== null
        ? stripUndefined(value)
        : value;
    }
  }
  return result as T;
}

/**
 * Appends a changelog entry, capping at MAX_CHANGELOG_ENTRIES.
 * Returns the new array (does not mutate the input).
 */
export function appendChangeLogEntry(
  log: ChangeLogEntry[] | undefined,
  entry: ChangeLogEntry,
): ChangeLogEntry[] {
  const existing = log ?? [];
  const updated = [...existing, entry];
  // Cap at max entries — keep newest, drop oldest
  if (updated.length > MAX_CHANGELOG_ENTRIES) {
    return updated.slice(updated.length - MAX_CHANGELOG_ENTRIES);
  }
  return updated;
}
