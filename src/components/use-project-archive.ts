// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProjectListItem } from '@/lib/storage-driver';
import { useStorage } from '@/contexts/storage-context';
import { useProjectPrefs } from '@/lib/use-project-prefs';
import { STORAGE_FULL_MESSAGE } from '@/lib/storage-errors';
import { focusAfterTileLeaves, type TileFocusTarget } from '@/lib/tile-focus';
import {
  isProjectArchived,
  isRefusedPrefId,
  projectPrefOf,
  shownProjects,
  type PrefRefusal,
  type ProjectColor,
  type ProjectPrefs,
} from '@/lib/project-prefs';
import { PREFS_UNREAD_REASON, REFUSED_ID_REASON } from './archive-controls';
import { UNNAMED_PROJECT } from '@/lib/cloud-load-guards';

const EMPTY: ProjectPrefs = {};
const LOADING_REASON = 'Unavailable until your tile colors and archive load';
export const PREFS_CAP_MESSAGE =
  'This can hold tile colors and archive for 1,000 projects, and that many are set. Clear a color or unarchive a project, then try again.';
const PREFS_FAILED_MESSAGE = "Couldn't save the tile color or archive. Please try again.";

interface UseProjectArchiveArgs {
  /** The full list: every count and every save reads this, never the shown list (O61). */
  projects: ProjectListItem[];
  /** A dialog has taken over the tab: the colour popover closes and does not come back with it. */
  dialogOpen: boolean;
  onOpenInCfd: (id: string) => void;
  /** Where the tab's focus goes after the tiles re-render. */
  requestFocus: (target: TileFocusTarget) => void;
  /** The tab's error alert. */
  showError: (text: string) => void;
}

/**
 * Archive, "Show archived (N)" and tile colour on the Projects tab (v0.21.0,
 * DASH26 R2), SPERT® Forecaster's `useProjectArchive` at df59b2d with CFD's
 * rulings:
 * - "Show archived (N)" shows when N > 0, off by default, not saved, and off
 *   again when N returns to 0. N counts listed projects, never map entries.
 * - Focus after Archive with the filter off: the next shown tile's name
 *   button, else the previous, else New Project; with it on, that tile's
 *   Unarchive. After Unarchive: that tile's Archive. Both announced politely.
 * - A click on an archived tile unarchives it and opens the CFD tab, with no
 *   message after (O58); the open project stays open on Archive (R35).
 * - Anyone who can see a tile may colour or archive it (O51). A refusal is
 *   said: storage full in R25's words, the cap (O63), else a retry message.
 * - Until the person's settings are read, Tile color, Archive and drag are
 *   off with a reason (O54); an id no entry may have is refused (O60).
 */
export function useProjectArchive({ projects, dialogOpen, onOpenInCfd, requestFocus, showError }: UseProjectArchiveArgs) {
  const { driver } = useStorage();
  const read = useProjectPrefs();
  const prefs = read.status === 'ready' ? read.prefs : EMPTY;
  const [showArchived, setShowArchived] = useState(false);
  const [colorOpenFor, setColorOpenFor] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  // DASH26 §7 answer 1: a failed read is tried again when the tab mounts.
  useEffect(() => {
    driver.retryProjectPrefs();
  }, [driver]);

  const archivedCount = useMemo(() => projects.filter((p) => isProjectArchived(prefs, p.id)).length, [projects, prefs]);
  // Off again once the last archived project is back: a guarded update during render.
  if (showArchived && archivedCount === 0) setShowArchived(false);
  /** What this person sees. Reordering and focus read it; every save and count reads `projects`. */
  const shown = useMemo(() => shownProjects(projects, prefs, showArchived), [projects, prefs, showArchived]);
  // A dialog has taken over, or the tile has gone: the popover must not come back with it.
  if (colorOpenFor !== null && (dialogOpen || !shown.some((p) => p.id === colorOpenFor))) setColorOpenFor(null);

  const blockedReason = useCallback(
    (id: string): string | null => {
      if (read.status === 'failed') return PREFS_UNREAD_REASON;
      if (read.status === 'loading') return LOADING_REASON;
      return isRefusedPrefId(id) ? REFUSED_ID_REASON : null;
    },
    [read.status],
  );
  const dragBlockedReason = read.status === 'failed' ? PREFS_UNREAD_REASON : read.status === 'loading' ? LOADING_REASON : null;

  const refused = useCallback(
    (refusal: PrefRefusal | null): boolean => {
      if (refusal === null) return false;
      if (refusal === 'full') showError(STORAGE_FULL_MESSAGE);
      else if (refusal === 'cap') showError(PREFS_CAP_MESSAGE);
      else if (refusal === 'failed') showError(PREFS_FAILED_MESSAGE);
      return true;
    },
    [showError],
  );

  const nameOf = useCallback((id: string) => projects.find((p) => p.id === id)?.name || UNNAMED_PROJECT, [projects]);

  const archive = useCallback(
    (id: string) => {
      if (refused(driver.setProjectPref(id, 'archived', true))) return;
      setColorOpenFor(null);
      const name = nameOf(id);
      if (showArchived) {
        requestFocus({ kind: 'unarchive', projectId: id });
        setStatus(`Archived "${name}".`);
        return;
      }
      requestFocus(focusAfterTileLeaves(shown, id));
      setStatus(`Archived "${name}". Show archived (${archivedCount + 1}) lists it.`);
    },
    [driver, refused, nameOf, showArchived, shown, archivedCount, requestFocus],
  );

  const unarchive = useCallback(
    (id: string) => {
      if (refused(driver.setProjectPref(id, 'archived', undefined))) return;
      requestFocus({ kind: 'archive', projectId: id });
      setStatus(`Unarchived "${nameOf(id)}".`);
    },
    [driver, refused, nameOf, requestFocus],
  );

  /** A tile's click: an archived project is unarchived first (O58), then the CFD tab opens, with no message after. */
  const openProject = useCallback(
    (id: string) => {
      if (isProjectArchived(prefs, id) && refused(driver.setProjectPref(id, 'archived', undefined))) return;
      onOpenInCfd(id);
    },
    [prefs, driver, refused, onOpenInCfd],
  );

  /** Colouring never touches the archive (GanttApp G1). False when refused: the popover puts the choice back. */
  const pickColor = useCallback(
    (id: string, color: ProjectColor | null): boolean => !refused(driver.setProjectPref(id, 'color', color ?? undefined)),
    [driver, refused],
  );

  const setColorOpen = useCallback((id: string, open: boolean) => {
    setColorOpenFor((current) => (open ? id : current === id ? null : current));
  }, []);

  const prefOf = useCallback((id: string) => projectPrefOf(prefs, id), [prefs]);

  return {
    read,
    prefOf,
    showArchived,
    setShowArchived,
    archivedCount,
    shown,
    status,
    colorOpenFor,
    setColorOpen,
    pickColor,
    archive,
    unarchive,
    openProject,
    blockedReason,
    dragBlockedReason,
  };
}
