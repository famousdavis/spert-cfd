// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.18.0 (DASH26 R7): a tile's meta lines are "N snapshots · M states" and
// "Last snapshot <date>", or "No snapshots yet · M states". Three ways the
// obvious code goes wrong, each pinned here:
// - the array's last row is not the latest date (a back-dated row added last,
//   or a newest-first CSV imported, stores an older date at the end);
// - `format(new Date('2026-06-18'))` prints Jun 17 west of UTC (measured in
//   America/New_York), and CI runs in UTC, where it looks right;
// - a stored date that is not a calendar date made `format` throw, which took
//   the whole Projects tab down to "This view could not be displayed".

import { describe, it, expect, afterEach } from 'vitest';
import { projectStats, tileMetaLines, STATS_LOADING, STATS_PENDING_LINE } from '../project-tile-meta';
import type { Snapshot } from '@/types';

const snap = (date: string): Snapshot => ({ date, counts: { backlog: 1 } });
const project = (dates: string[], states = 5) => ({ snapshots: dates.map(snap), workflow: Array.from({ length: states }) });

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe('tileMetaLines', () => {
  it('before the stats load: "Loading…" and a blank line, never "No snapshots yet"', () => {
    expect(tileMetaLines(undefined)).toEqual([STATS_LOADING, STATS_PENDING_LINE]);
    expect(STATS_LOADING).toBe('Loading…');
    expect(STATS_PENDING_LINE).toBe(' ');
  });

  it('with no snapshots: one line, the state count', () => {
    expect(tileMetaLines(projectStats(project([], 5)))).toEqual(['No snapshots yet · 5 states']);
    expect(tileMetaLines(projectStats(project([], 1)))).toEqual(['No snapshots yet · 1 state']);
  });

  it('with snapshots: the counts, then the latest date (R7\'s own example)', () => {
    const dates = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-08', '2026-06-09',
      '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18'];
    expect(tileMetaLines(projectStats(project(dates, 5)))).toEqual(['14 snapshots · 5 states', 'Last snapshot Jun 18, 2026']);
    expect(tileMetaLines(projectStats(project(['2026-06-18'], 1)))).toEqual(['1 snapshot · 1 state', 'Last snapshot Jun 18, 2026']);
  });

  it('the latest by date, not the last row: a back-dated row added last', () => {
    expect(tileMetaLines(projectStats(project(['2026-06-01', '2026-06-18', '2026-05-20'])))[1]).toBe('Last snapshot Jun 18, 2026');
  });

  it('the latest by date after a newest-first CSV round trip (oldest stored last)', () => {
    expect(tileMetaLines(projectStats(project(['2026-06-18', '2026-06-17', '2026-06-01'])))[1]).toBe('Last snapshot Jun 18, 2026');
  });

  it.each(['UTC', 'America/New_York', 'America/Los_Angeles', 'Pacific/Kiritimati'])('the same day in %s', (tz) => {
    process.env.TZ = tz;
    expect(tileMetaLines(projectStats(project(['2026-06-18'])))[1]).toBe('Last snapshot Jun 18, 2026');
  });

  it('a stored date that is not a calendar date renders as written, without throwing', () => {
    const lines = tileMetaLines(projectStats(project(['2026-06-18', '2026-13-45'])));
    expect(lines).toEqual(['2 snapshots · 5 states', 'Last snapshot 2026-13-45']);
  });
});
