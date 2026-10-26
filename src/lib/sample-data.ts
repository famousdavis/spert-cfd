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

function sampleYear(): number {
  return Math.max(new Date().getFullYear(), 2026);
}

function makeSnapshots(): Snapshot[] {
  const stateIds = ['backlog', 'analysis', 'dev', 'review', 'done'];
  const year = sampleYear();

  // A steady flow: new requests arrive as work finishes, and work starts
  // about as fast as it finishes, so Little's Law holds on every period and
  // the panel shows no stability warning. (A closed backlog that only drains
  // is not steady: Lead Time warned on every period.) Review ends above its
  // WIP limit, to show that warning.
  const raw: Array<[string, number[]]> = [
    [`${year}-01-01`, [10, 2, 3, 2, 0]],
    [`${year}-01-02`, [9, 3, 3, 2, 1]],
    [`${year}-01-03`, [9, 2, 3, 2, 3]],
    [`${year}-01-04`, [9, 2, 4, 2, 4]],
    [`${year}-01-05`, [10, 2, 3, 2, 6]],
    [`${year}-01-08`, [10, 3, 2, 2, 7]],
    [`${year}-01-09`, [9, 2, 3, 2, 9]],
    [`${year}-01-10`, [9, 3, 3, 2, 10]],
    [`${year}-01-11`, [10, 2, 3, 2, 12]],
    [`${year}-01-12`, [9, 3, 3, 2, 13]],
    [`${year}-01-15`, [10, 2, 3, 2, 15]],
    [`${year}-01-16`, [10, 2, 4, 2, 16]],
    [`${year}-01-17`, [10, 2, 2, 3, 18]],
    [`${year}-01-18`, [10, 2, 2, 3, 20]],
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
    createdAt: `${sampleYear()}-01-01T00:00:00.000Z`,
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
