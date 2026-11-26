// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

// Archive on the Projects tab (v0.21.0, DASH26 R2, O50, O54): SPERT®
// Forecaster's `ArchiveControls.tsx` at df59b2d, and CFD's line for a failed
// read of the person's settings.

import { ALL_ARCHIVED, CHECK, CHECKBOX, PREFS_UNREAD } from './dashboard-styles';

/** "Show archived (N)": rendered only while N > 0; off by default and not saved. */
export function ShowArchivedFilter({ count, checked, onChange }: { count: number; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    // leading-[normal]: GanttApp's row is line-height normal. Its place is the
    // frame's filter row (ArchiveRows, below), no longer its own `-mt-1`.
    <div className="leading-[normal]">
      <label className={CHECK} htmlFor="show-archived">
        <input
          type="checkbox"
          id="show-archived"
          name="showArchived"
          className={CHECKBOX}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        Show archived ({count})
      </label>
    </div>
  );
}

/** Where Archive and Unarchive speak: polite, visually hidden, and no role="status". */
export function ArchiveAnnouncer({ text }: { text: string }) {
  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {text}
    </p>
  );
}

/**
 * Every project archived and the filter off: GanttApp's line where the grid
 * would be. Never the welcome panel. It stands in for the tile grid, so it
 * carries the frame's `data-sf="empty"` (contract §7, v0.22.0), as SPERT®
 * Forecaster's does.
 */
export function AllArchivedLine({ count }: { count: number }) {
  return <p className={ALL_ARCHIVED} data-sf="empty">{`All projects are archived. Select "Show archived (${count})" to see them.`}</p>;
}

/**
 * What the Projects tab shows above the grid for archive (v0.21.0): the filter,
 * O54's line, the announcer.
 *
 * v0.22.0 (FRAME26, contract §3 "Filter row"): the filter and O54's line are
 * the collection's ONE filter row, hooked `data-sf="filters"`, 16 px below the
 * heading row with the grid 16 px below it. It renders while something is
 * archived or the person's settings could not be read. O54's line sits below
 * the filter: it says why the collection's own controls (Tile color, Archive,
 * drag) are off, and the contract lets the row hold that one status line. In
 * practice the two never show together: after a failed read the map is
 * unknown, so nothing counts as archived. Not in the frame's notices slot,
 * which is app-wide; not between the row and the grid, where frame-check would
 * read the grid as sitting low.
 */
export function ArchiveRows({
  archivedCount,
  showArchived,
  onShowArchivedChange,
  unread,
  status,
}: {
  archivedCount: number;
  showArchived: boolean;
  onShowArchivedChange: (checked: boolean) => void;
  unread: boolean;
  status: string;
}) {
  return (
    <>
      {(archivedCount > 0 || unread) && (
        <div className="sf-below space-y-2" data-sf="filters">
          {/* Only while something is archived (O50). */}
          {archivedCount > 0 && <ShowArchivedFilter count={archivedCount} checked={showArchived} onChange={onShowArchivedChange} />}
          {/* O54: only after a read of the person's settings failed, never while it loads. */}
          {unread && <PrefsUnreadLine />}
        </div>
      )}
      <ArchiveAnnouncer text={status} />
    </>
  );
}

/**
 * O54's words: the line, and the reason the disabled controls give. The line
 * says what tries again (PR #115 review, Opus-PR115-1 -03): a switch to another
 * tab or window and back (the window's `focus`, the page's `visibilitychange`,
 * or the Projects tab mounting again) and a reload each read the settings
 * again. "They come back once they load" promised a load nothing made.
 */
export const PREFS_UNREAD_TEXT =
  "Your tile colors and archive couldn't be loaded, so Tile color, Archive and drag are off. To try again, switch to another tab or window and back, or reload the page.";
export const PREFS_UNREAD_REASON = "Unavailable: your tile colors and archive couldn't be loaded";
/** O60: a project whose id no entry may have. */
export const REFUSED_ID_REASON = "Unavailable for this project: its id can't hold a tile color or archive";

/** Shown only after a read of the person's settings failed (O54), never during a normal load. */
export function PrefsUnreadLine() {
  return (
    <p role="status" className={PREFS_UNREAD}>
      {PREFS_UNREAD_TEXT}
    </p>
  );
}
