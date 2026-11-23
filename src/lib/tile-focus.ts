// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Finding a dashboard tile's controls when focus must land on one after a
// dialog closes or a delete (v0.18.0, DASH26 R1a; SPERT® Forecaster's
// `src/features/projects/lib/tile-focus.ts` at df59b2d). The tile is found by
// its project id (`data-project-id`), never by a CSS selector built from the
// id: an id may hold any character. Its controls are found by their names,
// which keep the project's name, read with getAttribute('aria-label') and
// compared as TEXT. A selector built from a name would throw on a name holding
// `"` and find nothing for one holding `\`.

export type TileControl = 'open' | 'edit' | 'delete' | 'archive' | 'unarchive';

/**
 * v0.21.0 (DASH26 R2, O58, O61): an archived tile's name button says
 * "Unarchive and open CFD for {name}", so `open` matches both names; and
 * Unarchive's own name starts like it, so `unarchive` takes the one that is
 * not the name button.
 */
const OPEN_UNARCHIVE = 'Unarchive and open CFD for ';
const MATCH: Record<TileControl, (label: string) => boolean> = {
  open: (l) => l.startsWith('Open CFD for ') || l.startsWith(OPEN_UNARCHIVE),
  edit: (l) => l.startsWith('Edit '),
  delete: (l) => l.startsWith('Delete '),
  archive: (l) => l.startsWith('Archive '),
  unarchive: (l) => l.startsWith('Unarchive ') && !l.startsWith(OPEN_UNARCHIVE),
};

const labelOf = (el: Element) => el.getAttribute('aria-label') ?? '';

function tileButtons(root: ParentNode | null, projectId: string): HTMLElement[] {
  const tile = Array.from(root?.querySelectorAll<HTMLElement>('[data-tile="true"]') ?? []).find(
    (el) => el.dataset.projectId === projectId,
  );
  return Array.from(tile?.querySelectorAll<HTMLElement>('button') ?? []);
}

/** The control on `projectId`'s tile under `root`; null when the tile or the control is not there. */
export function findTileControl(root: ParentNode | null, projectId: string, control: TileControl): HTMLElement | null {
  return tileButtons(root, projectId).find((b) => MATCH[control](labelOf(b))) ?? null;
}

/** Where focus goes once the tiles have re-rendered. */
export type TileFocusTarget = { kind: TileControl; projectId: string } | { kind: 'new' };

/**
 * Where focus goes when a tile leaves the grid (DASH26 O12): the next tile's
 * name button, else the previous tile's, else New Project. Since v0.19.0 the
 * last project may be deleted (R10), so the third branch is the delete of the
 * last tile: focus goes to New Project, above the welcome panel.
 */
export function focusAfterTileLeaves(shown: { id: string }[], leavingId: string): TileFocusTarget {
  const index = shown.findIndex((p) => p.id === leavingId);
  const neighbour = index === -1 ? undefined : (shown[index + 1] ?? shown[index - 1]);
  return neighbour ? { kind: 'open', projectId: neighbour.id } : { kind: 'new' };
}

/** The element a focus target names, or null when it is not on screen. */
export function resolveFocusTarget(
  root: ParentNode | null,
  target: TileFocusTarget,
  newProject: HTMLElement | null,
): HTMLElement | null {
  if (target.kind === 'new') return newProject;
  return findTileControl(root, target.projectId, target.kind);
}
