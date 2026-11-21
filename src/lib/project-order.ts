// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The stored project order with `id` placed right after `after` (v0.19.0,
 * DASH26 O22), for a positioned create (Clone).
 *
 * - The STORED order is the base and only `id` moves, so an order written in
 *   another tab or on another device survives (O22 a).
 * - When `after` is not in the stored order (a project shared with this person,
 *   or an own one whose append failed, O22 b), the ids shown on screen that are
 *   not yet stored, up to and including `after`, are written first, then `id`.
 *   They already sort after every stored id (unordered ids sort last), so
 *   nothing on screen moves, and the copy lands right after its source.
 *   Pinning `after` alone would move it ahead of the unordered ids before it
 *   (measured, DASH26 R1b pre-flight D2).
 * - When `after` is neither stored nor shown, `id` is appended.
 */
export function placeAfter(
  stored: readonly string[],
  shownIds: readonly string[],
  after: string,
  id: string,
): string[] {
  const base = stored.filter((x) => x !== id);
  const at = base.indexOf(after);
  if (at >= 0) return [...base.slice(0, at + 1), id, ...base.slice(at + 1)];
  const shownAt = shownIds.indexOf(after);
  const head = shownAt < 0 ? [] : shownIds.slice(0, shownAt + 1).filter((x) => x !== id && !base.includes(x));
  return [...base, ...head, id];
}
