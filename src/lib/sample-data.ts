// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { nanoid } from 'nanoid';
import type { Project, WorkflowState, Snapshot } from '@/types';
import { PRESET_COLORS } from './colors';

function makeWorkflow(): WorkflowState[] {
  return [
    { id: 'backlog', name: 'Backlog', color: PRESET_COLORS[0], category: 'backlog', order: 0 },
    { id: 'analysis', name: 'Analysis', color: PRESET_COLORS[3], category: 'active', wipLimit: 3, order: 1 },
    { id: 'dev', name: 'In Dev', color: PRESET_COLORS[8], category: 'active', wipLimit: 5, order: 2 },
    { id: 'review', name: 'Review', color: PRESET_COLORS[9], category: 'active', wipLimit: 2, order: 3 },
    { id: 'done', name: 'Done', color: PRESET_COLORS[6], category: 'done', order: 4 },
  ];
}

function makeSnapshots(): Snapshot[] {
  const stateIds = ['backlog', 'analysis', 'dev', 'review', 'done'];

  // A steady flow: new requests arrive as work finishes, and work starts
  // about as fast as it finishes, so Little's Law holds on every period and
  // the panel shows no stability warning. (A closed backlog that only drains
  // is not steady: Lead Time warned on every period.) Review ends above its
  // WIP limit, to show that warning.
  //
  // Recorded Monday to Friday over three working weeks, June 1-18, 2026, with
  // no US federal holiday in them, so the days it skips (6-7, 13-14) are
  // weekends. The year is pinned: one computed from today would move every
  // date to another weekday (June 1, 2027 is a Tuesday).
  const raw: Array<[string, number[]]> = [
    ['2026-06-01', [10, 2, 3, 2, 0]],
    ['2026-06-02', [9, 3, 3, 2, 1]],
    ['2026-06-03', [9, 2, 3, 2, 3]],
    ['2026-06-04', [9, 2, 4, 2, 4]],
    ['2026-06-05', [10, 2, 3, 2, 6]],
    ['2026-06-08', [10, 3, 2, 2, 7]],
    ['2026-06-09', [9, 2, 3, 2, 9]],
    ['2026-06-10', [9, 3, 3, 2, 10]],
    ['2026-06-11', [10, 2, 3, 2, 12]],
    ['2026-06-12', [9, 3, 3, 2, 13]],
    ['2026-06-15', [10, 2, 3, 2, 15]],
    ['2026-06-16', [10, 2, 4, 2, 16]],
    ['2026-06-17', [10, 2, 2, 3, 18]],
    ['2026-06-18', [10, 2, 2, 3, 20]],
  ];

  return raw.map(([date, counts]) => ({
    date,
    counts: Object.fromEntries(stateIds.map((id, i) => [id, counts[i]])),
  }));
}

/**
 * Creates a fresh sample project. Each call produces a new unique ID.
 */
export function createSampleProject(): Project {
  const now = new Date().toISOString();
  return {
    id: nanoid(8),
    name: 'Sample: 2-Week Sprint',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: now,
    workflow: makeWorkflow(),
    snapshots: makeSnapshots(),
    settings: {
      gridSortNewestFirst: true,
      showWipWarnings: true,
      metricsPeriod: { kind: 'all' },
    },
  };
}
