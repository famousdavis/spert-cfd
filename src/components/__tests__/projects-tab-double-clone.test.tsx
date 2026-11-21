// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.19.0 (DASH26 PR #109 review -02, G2): a double Clone in cloud on a project
// that is not open. handleClone awaits the source's read (a getDoc round trip)
// and then calls cloneProject; a second click inside that round trip named its
// copy from the list as it was at the click, so both copies were "Alpha (copy)".
// The copy is now named, and its on-screen ids taken, at add time from the
// current list. The reviewer's probe
// (`rev-pr109/opus-pr109-1-work/zz-opus-probe-double-clone.test.tsx`), kept as
// the regression test; it failed at d454227. Real ProjectListProvider and tab;
// a cloud-mode driver whose reads are held.

import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import type { StorageDriver } from '@/lib/storage-driver';
import type { Project } from '@/types';

const h = vi.hoisted(() => ({ driver: null as unknown, defer: false }));
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({ driver: h.driver, mode: (h.driver as { mode: string }).mode }),
}));
vi.mock('@/contexts/active-project-context', () => ({ useActiveProject: () => ({ project: null }) }));
vi.mock('../sharing-modal', () => ({ SharingModal: () => null }));

import { ProjectListProvider } from '@/contexts/project-list-context';
import { ProjectsTab } from '../projects-tab';
import { createLocalStorageDriver } from '@/lib/local-storage-driver';

function project(id: string, name: string): Project {
  return {
    id, name, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    workflow: [{ id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 }],
    snapshots: [], settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
  };
}

const created: Array<{ name: string; placement: { after: string; shownIds: readonly string[] } | undefined }> = [];
const pendingLoads: Array<() => void> = [];

function cloudDriver(deferLoads: boolean): StorageDriver {
  return {
    ...createLocalStorageDriver(),
    mode: 'cloud',
    workspaceId: 'uid-me',
    loadProjectList: async () => [
      { id: 'a', name: 'Alpha', owner: 'uid-me', role: 'owner' as const, memberCount: 1 },
      { id: 'b', name: 'Beta', owner: 'uid-me', role: 'owner' as const, memberCount: 1 },
    ],
    loadProject: (id: string) => {
      const p = project(id, id === 'a' ? 'Alpha' : 'Beta');
      if (!deferLoads || !h.defer) return Promise.resolve(p);
      return new Promise<Project>((resolve) => { pendingLoads.push(() => resolve(p)); });
    },
    createProject: async (p: Project, placement?: { after: string; shownIds: readonly string[] }) => { created.push({ name: p.name, placement }); },
    onProjectListChange: () => () => {},
    onProjectChange: () => () => {},
  } as StorageDriver;
}

beforeEach(() => {
  h.defer = false;
  localStorage.clear();
  created.length = 0;
  pendingLoads.length = 0;
});

const tileNames = () =>
  screen.queryAllByRole('button', { name: /^Open CFD for / }).map((b) => b.getAttribute('aria-label')!.replace('Open CFD for ', ''));

it('two Clone clicks on a not-open cloud source while its read is in flight: "X (copy)" then "X (copy 2)", each placed against the current list', async () => {
  h.driver = cloudDriver(true);
  render(<ProjectListProvider><ProjectsTab onOpenInCfd={vi.fn()} /></ProjectListProvider>);
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  const cloneAlpha = () => screen.getByRole('button', { name: 'Clone Alpha' });
  h.defer = true;
  await act(async () => { fireEvent.click(cloneAlpha()); });
  await act(async () => { fireEvent.click(cloneAlpha()); });
  h.defer = false;
  expect(pendingLoads.length).toBe(2); // both reads in flight at the second click: the double click
  await act(async () => { pendingLoads[0](); await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { pendingLoads[1](); await new Promise((r) => setTimeout(r, 10)); });
  expect(created.map((c) => c.name)).toEqual(['Alpha (copy)', 'Alpha (copy 2)']);
  // The second copy is placed against the list that holds the first: Alpha, the first copy, Beta.
  expect(created[1].placement?.shownIds.length).toBe(3);
  expect(tileNames()).toEqual(['Alpha', 'Alpha (copy 2)', 'Alpha (copy)', 'Beta']);
  expect(document.querySelector('[data-clone-status]')?.textContent).toBe('Cloned "Alpha" as "Alpha (copy 2)".');
});

it('control: the same two clicks with each read settled before the next click', async () => {
  h.driver = cloudDriver(false);
  render(<ProjectListProvider><ProjectsTab onOpenInCfd={vi.fn()} /></ProjectListProvider>);
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  const cloneAlpha = () => screen.getByRole('button', { name: 'Clone Alpha' });
  await act(async () => { fireEvent.click(cloneAlpha()); await new Promise((r) => setTimeout(r, 10)); });
  await act(async () => { fireEvent.click(cloneAlpha()); await new Promise((r) => setTimeout(r, 10)); });
  expect(created.map((c) => c.name)).toEqual(['Alpha (copy)', 'Alpha (copy 2)']);
});
