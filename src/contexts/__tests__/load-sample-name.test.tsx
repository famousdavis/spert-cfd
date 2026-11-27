// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom
//
// v0.23.0 (FRAME26 clean-up L): loadSampleProject names the copy against EVERY
// listed project, archived ones included (archive is each person's own
// setting, kept apart from the list: `spertcfd-project-prefs`), and resolves
// with its id and name. Real providers, the real local driver, jsdom's
// localStorage. The cloud half is in cloud-create-open.test.tsx.
import { it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import type { StorageDriver } from '@/lib/storage-driver';
import type { Project } from '@/types';

let driver: StorageDriver;
vi.mock('@/contexts/storage-context', () => ({ useStorage: () => ({ driver, mode: driver.mode }) }));

import { createLocalStorageDriver } from '@/lib/local-storage-driver';
import { ProjectListProvider, useProjectList } from '../project-list-context';

const BASE = 'Sample: 2-Week Sprint';
const project = (id: string, name: string): Project => ({
  id, name, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  workflow: [{ id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 }, { id: 'done', name: 'Done', color: '#22c55e', category: 'done', order: 1 }],
  snapshots: [], settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
});
const wrapper = ({ children }: { children: React.ReactNode }) => <ProjectListProvider>{children}</ProjectListProvider>;
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

beforeEach(() => {
  localStorage.clear();
  driver = createLocalStorageDriver();
});

async function load(seed: Array<[string, string]>, archived: string[] = []) {
  for (const [id, name] of seed) await driver.createProject(project(id, name));
  if (archived.length) localStorage.setItem('spertcfd-project-prefs', JSON.stringify(Object.fromEntries(archived.map((id) => [id, { archived: true }]))));
  const { result } = renderHook(() => useProjectList(), { wrapper });
  await settle();
  let out!: { id: string; name: string };
  await act(async () => { out = await result.current.loadSampleProject(); });
  return { out, result };
}

it('the first sample takes the base name and resolves with its id and name; it is listed and saved under that name', async () => {
  const { out, result } = await load([]);
  expect(out.name).toBe(BASE);
  expect(result.current.projects).toEqual([expect.objectContaining({ id: out.id, name: BASE })]);
  expect((await driver.loadProject(out.id))?.name).toBe(BASE);
});

it('an ARCHIVED project holding the base name still holds it: the copy is "(2)"', async () => {
  const { out } = await load([['s0', BASE]], ['s0']);
  expect(out.name).toBe(`${BASE} (2)`);
  expect((await driver.loadProject(out.id))?.name).toBe(`${BASE} (2)`);
});

it('a person\'s own project named like a sample holds its name: base and their "(2)" give "(3)"', async () => {
  const { out } = await load([['a', BASE], ['b', `${BASE} (2)`], ['c', 'Alpha']]);
  expect(out.name).toBe(`${BASE} (3)`);
});

it('"(2)" taken but the base free: the base', async () => {
  const { out } = await load([['b', `${BASE} (2)`]]);
  expect(out.name).toBe(BASE);
});

it('two loads in a row: the base, then "(2)"', async () => {
  const { out, result } = await load([]);
  let second!: { id: string; name: string };
  await act(async () => { second = await result.current.loadSampleProject(); });
  expect([out.name, second.name]).toEqual([BASE, `${BASE} (2)`]);
  expect(result.current.projects.map((p) => p.name)).toEqual([BASE, `${BASE} (2)`]);
});
