// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

// Archive on the Projects tab (v0.21.0, DASH26 R2, O50, O54): SPERT®
// Forecaster's `ArchiveControls.tsx` at df59b2d, and CFD's line for a failed
// read of the person's settings.

import { ALL_ARCHIVED, CHECK, CHECKBOX, PREFS_UNREAD, SHOW_ARCHIVED_ROW } from './dashboard-styles';

/** "Show archived (N)": rendered only while N > 0; off by default and not saved. */
export function ShowArchivedFilter({ count, checked, onChange }: { count: number; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className={SHOW_ARCHIVED_ROW}>
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

/** Every project archived and the filter off: GanttApp's line where the grid would be. Never the welcome panel. */
export function AllArchivedLine({ count }: { count: number }) {
  return <p className={ALL_ARCHIVED}>{`All projects are archived. Select "Show archived (${count})" to see them.`}</p>;
}

/** What the Projects tab shows above the grid for archive (v0.21.0): the filter, O54's line, the announcer. */
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
      {/* Only while something is archived (O50). */}
      {archivedCount > 0 && <ShowArchivedFilter count={archivedCount} checked={showArchived} onChange={onShowArchivedChange} />}
      {/* O54: only after a read of the person's settings failed, never while it loads. */}
      {unread && <PrefsUnreadLine />}
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
