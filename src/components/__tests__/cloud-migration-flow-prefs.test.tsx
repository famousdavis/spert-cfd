// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.21.0 (DASH26 R2, O61, O64): the upload reads the FULL list, archived
// projects included, counts them in its confirmation, and hands this
// browser's colours and archive to the upload; a colour/archive write that did
// not carry is named after the switch. The upload's writes themselves are on
// the emulator (emulator-tests/project-prefs.test.ts).
import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import type { ProjectListItem } from '@/lib/storage-driver';

const h = vi.hoisted(() => ({
  projects: [] as ProjectListItem[],
  switchMode: vi.fn(),
  migrate: vi.fn(),
  clear: vi.fn(async (..._args: unknown[]) => {}),
  driver: null as unknown,
}));
vi.mock('@/contexts/storage-context', () => ({ useStorage: () => ({ driver: h.driver, switchMode: h.switchMode }) }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: { uid: 'uid-me' } }) }));
vi.mock('@/contexts/project-list-context', () => ({ useProjectList: () => ({ projects: h.projects }) }));
vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('@/lib/firestore-driver', () => ({ createFirestoreDriver: () => ({}) }));
vi.mock('@/lib/cloud-migration', () => ({
  migrateLocalToCloud: (...args: unknown[]) => h.migrate(...args),
  clearLocalProjects: (...args: unknown[]) => h.clear(...args),
}));

import { CloudMigrationFlow, type CloudMigrationFlowHandle } from '../cloud-migration-flow';
import { createLocalStorageDriver } from '@/lib/local-storage-driver';
import { LS_PROJECT_PREFS } from '@/lib/constants';

const project = (id: string, name: string) => ({
  id,
  name,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  workflow: [{ id: 'bl', name: 'Backlog', color: '#64748b', category: 'backlog' as const, order: 0 }],
  snapshots: [],
  settings: { gridSortNewestFirst: false, showWipWarnings: true, metricsPeriod: { kind: 'all' as const } },
});

beforeEach(async () => {
  localStorage.clear();
  const seed = createLocalStorageDriver();
  for (const [id, name] of [['a', 'Alpha'], ['b', 'Bravo'], ['c', 'Charlie']]) await seed.createProject(project(id, name));
  localStorage.setItem(LS_PROJECT_PREFS, JSON.stringify({ b: { archived: true, color: 'pink' } }));
  h.driver = createLocalStorageDriver();
  h.projects = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Bravo' }, { id: 'c', name: 'Charlie' }];
  h.switchMode.mockReset();
  h.migrate.mockReset();
});

async function startUpload() {
  const ref = createRef<CloudMigrationFlowHandle>();
  render(<CloudMigrationFlow ref={ref} />);
  act(() => ref.current!.requestCloudSwitch());
}

it('counts and uploads every project, the archived one included, with this browser\'s map', async () => {
  h.migrate.mockResolvedValue({ uploaded: 3, skipped: 0, pairs: [], prefsNotCarried: [] });
  await startUpload();
  expect(screen.getByText(/local project/).textContent).toContain('3');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    await new Promise((res) => setTimeout(res, 0));
  });
  const [, , uploaded, , prefs] = h.migrate.mock.calls[0] as [unknown, unknown, Array<{ id: string }>, unknown, unknown];
  expect(uploaded.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  expect(prefs).toEqual({ b: { archived: true, color: 'pink' } });
  expect(h.switchMode).toHaveBeenCalledWith('cloud');
});

it('PR #115 review (Opus-PR115-1 -01): the upload carries this browser\'s key as it is now, another tab\'s change included', async () => {
  // This tab (B) read its map; then another tab (A) archives Alpha. B's copy in memory does not have it.
  expect((h.driver as ReturnType<typeof createLocalStorageDriver>).getProjectPrefs()).toEqual({ status: 'ready', prefs: { b: { archived: true, color: 'pink' } } });
  expect(createLocalStorageDriver().setProjectPref('a', 'archived', true)).toBeNull();
  h.migrate.mockResolvedValue({ uploaded: 3, skipped: 0, pairs: [], prefsNotCarried: [] });
  await startUpload();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    await new Promise((res) => setTimeout(res, 0));
  });
  const prefs = (h.migrate.mock.calls[0] as unknown[])[4];
  expect(prefs).toEqual({ a: { archived: true }, b: { archived: true, color: 'pink' } });
});

it('a colour/archive write that did not carry: still switches to Cloud, and names the project', async () => {
  h.migrate.mockResolvedValue({ uploaded: 3, skipped: 0, pairs: [], prefsNotCarried: ['Bravo'] });
  await startUpload();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    await new Promise((res) => setTimeout(res, 0));
  });
  expect(h.switchMode).toHaveBeenCalledWith('cloud');
  expect(screen.getByText(/Tile colors and archive did not carry for "Bravo"/)).toBeTruthy();
});
