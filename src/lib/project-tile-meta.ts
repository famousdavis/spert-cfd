// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { Snapshot } from '@/types';
import { formatDate, sortSnapshots } from './dates';

/**
 * What a project's tile says about it, read from the whole project
 * (`ProjectsTab`'s stats load). v0.18.0 (DASH26 R7): the count of snapshots
 * and states, and the date of the latest snapshot; "Updated" left the tile.
 */
export interface ProjectStats {
  snapshotCount: number;
  workflowStateCount: number;
  /** The latest snapshot's date by date (`YYYY-MM-DD`), not the stored array's last row; absent with none. */
  lastSnapshotDate?: string;
}

/** Shown on the second line while the stats load, so the tile keeps its height. */
export const STATS_PENDING_LINE = ' ';
export const STATS_LOADING = 'Loading…';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The stats of one project. The latest snapshot is found by date
 * (`sortSnapshots`): stored rows keep their insertion order, so a back-dated
 * row added last, or a newest-first CSV imported, puts an older date at the end.
 */
export function projectStats(project: { snapshots: Snapshot[]; workflow: unknown[] }): ProjectStats {
  const latest = sortSnapshots(project.snapshots).at(-1);
  return {
    snapshotCount: project.snapshots.length,
    workflowStateCount: project.workflow.length,
    ...(latest ? { lastSnapshotDate: latest.date } : {}),
  };
}

/**
 * The tile's meta lines (R7):
 * - stats not loaded → "Loading…" and a blank line (never "No snapshots yet",
 *   which would be a false claim about a project whose stats merely have not
 *   arrived);
 * - no snapshots → "No snapshots yet · N states";
 * - otherwise "N snapshots · M states" and "Last snapshot <date>".
 * The date goes through `formatDate` (`parseISO`, so the day is the stored day
 * in every time zone, and a stored date that is not a calendar date is shown
 * as written rather than throwing).
 */
export function tileMetaLines(stats: ProjectStats | undefined): string[] {
  if (!stats) return [STATS_LOADING, STATS_PENDING_LINE];
  const states = plural(stats.workflowStateCount, 'state');
  if (stats.snapshotCount === 0 || !stats.lastSnapshotDate) return [`No snapshots yet · ${states}`];
  return [`${plural(stats.snapshotCount, 'snapshot')} · ${states}`, `Last snapshot ${formatDate(stats.lastSnapshotDate)}`];
}
