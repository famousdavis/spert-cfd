// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * A drag-and-drop move applied to a stored project order (v0.20.2, DASH26
 * R2o, O53a). Both drivers and the Projects list build a drop from these, so
 * the screen and the stored order agree.
 *
 * A drop is a MOVE (the dragged tile takes the target tile's place), never a
 * final list: applied to the order read fresh at the time, it keeps what
 * another tab or device did meanwhile, and every id the stored order holds
 * that this tab does not show keeps its slot.
 *
 * The order of the two steps matters. `withStoredSlots` comes first and the
 * move is made in its result. The other way round, `withStoredSlots(fresh,
 * movedIds)` returns the stored order unchanged and the drop is lost
 * (Opus-R2-1 -09).
 */

/**
 * The full order a move starts from: every id the stored order holds, in its
 * slot, whether or not this tab lists it, then each of `ids` the stored order
 * lacks, in `ids`' order (SPERT® Story Map's `withStoredSlots`, R89). A stored
 * value that is not a list reads as none; a non-string or repeated id is
 * dropped (a repeat keeps its first slot).
 */
export function withStoredSlots(stored: unknown, ids: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (id: unknown) => {
    if (typeof id === 'string' && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  };
  if (Array.isArray(stored)) stored.forEach(add);
  ids.forEach(add);
  return out;
}

/**
 * `full` with the shown ids in `shownIds`' order: each slot that held a shown
 * id takes the next id of `shownIds`, and every other id keeps its slot
 * (SPERT® Forecaster's `reorderShown`). Always the whole of `full`.
 */
export function reorderShown(full: readonly string[], shownIds: readonly string[]): string[] {
  const shown = new Set(shownIds);
  let next = 0;
  return full.map((id) => (shown.has(id) ? shownIds[next++] : id));
}

/**
 * `full` after dropping `draggedId` on `targetId`'s tile: among the ids of
 * `full` that are shown, the dragged one is taken out and put in the target's
 * place (dnd-kit's `arrayMove`, in both directions), and every id that is not
 * shown keeps its slot. Null when either id is not shown in `full`, or when
 * they are the same, so the move changes nothing.
 */
export function moveAmongShown(
  full: readonly string[],
  shown: ReadonlySet<string>,
  draggedId: string,
  targetId: string,
): string[] | null {
  const ids = full.filter((id) => shown.has(id));
  const from = ids.indexOf(draggedId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return null;
  ids.splice(from, 1);
  ids.splice(to, 0, draggedId);
  return reorderShown(full, ids);
}

/** Whether `a` and `b` hold exactly the same ids, each as many times. */
export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const id of a) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const id of b) {
    const n = counts.get(id);
    if (!n) return false;
    counts.set(id, n - 1);
  }
  return true;
}
