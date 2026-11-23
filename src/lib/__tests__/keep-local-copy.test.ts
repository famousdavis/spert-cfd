// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.21.0 (DASH26 R36, O61; §7 answer 7): Keep local copy copies every listed
// project, archived ones included, and the person's colours and archive for
// those copied, into this browser's key, under the same ids.
import { it, expect, beforeEach, vi } from 'vitest';
import type { Project } from '@/types';
import type { ProjectListItem, StorageDriver } from '../storage-driver';
import type { PrefsRead } from '../project-prefs';
import { keepLocalCopy } from '../keep-local-copy';
import { LS_PROJECT_PREFS } from '../constants';

const project = (id: string, name: string): Project => ({
  id,
  name,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  workflow: [{ id: 'bl', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 }],
  snapshots: [],
  settings: { gridSortNewestFirst: false, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
});
const listed: ProjectListItem[] = [{ id: 'c1', name: 'One' }, { id: 'c2', name: 'Two' }, { id: 'c3', name: 'Gone' }];
function cloud(read: PrefsRead): StorageDriver {
  return {
    loadProject: async (id: string) => (id === 'c3' ? null : project(id, id)),
    getProjectPrefs: () => read,
  } as unknown as StorageDriver;
}
const stored = () => JSON.parse(localStorage.getItem(LS_PROJECT_PREFS) ?? 'null');
const index = () => JSON.parse(localStorage.getItem('cfd-lab') ?? '{}').projectIds;

beforeEach(() => localStorage.clear());

it('copies every project it can read, the archived one too, and their entries under the same ids', async () => {
  localStorage.setItem(LS_PROJECT_PREFS, JSON.stringify({ local: { color: 'slate' } }));
  const read: PrefsRead = { status: 'ready', prefs: { c2: { archived: true, color: 'teal' }, c3: { color: 'pink' }, other: { archived: true } } };
  expect(await keepLocalCopy(listed, cloud(read))).toEqual({ copied: ['c1', 'c2'] });
  expect(index()).toEqual(['c1', 'c2']);
  expect(stored()).toEqual({ local: { color: 'slate' }, c2: { archived: true, color: 'teal' } });
});

it('copies no colour or archive when the cloud map was never read', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await keepLocalCopy(listed, cloud({ status: 'failed' }));
  expect(index()).toEqual(['c1', 'c2']);
  expect(stored()).toBeNull();
});
