// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom
//
// Which project is open after a delete or a reload, in local mode. The real
// ProjectListProvider and ActiveProjectProvider over the real local driver
// and jsdom's localStorage; only useStorage is replaced, to hand them that
// driver (the real StorageProvider pulls in Firebase Auth).
//
// Fixtures use the shape createProject builds. A project with an empty
// workflow is dropped by validateProjectData on load, and the provider then
// seeds the sample project instead, so a test with a minimal fixture would be
// testing the sample.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import type { StorageDriver } from '@/lib/storage-driver';
import type { Project } from '@/types';

let driver: StorageDriver;
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({ driver, mode: 'local' }),
}));

import { createLocalStorageDriver } from '@/lib/local-storage-driver';
import { LS_ACTIVE_PROJECT } from '@/lib/constants';
import { ProjectListProvider, useProjectList } from '../project-list-context';
import { ActiveProjectProvider, useActiveProject } from '../active-project-context';

function project(id: string, name: string): Project {
  return {
    id,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    workflow: [
      { id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 },
      { id: 'dev', name: 'In Dev', color: '#3b82f6', category: 'active', order: 1 },
      { id: 'done', name: 'Done', color: '#22c55e', category: 'done', order: 2 },
    ],
    snapshots: [],
    settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ProjectListProvider>
    <ActiveProjectProvider>{children}</ActiveProjectProvider>
  </ProjectListProvider>
);

/** Runs `fn` and lets the promise chains and effects it starts finish. */
async function settle(fn: () => unknown = () => {}) {
  await act(async () => {
    fn();
    await new Promise((res) => setTimeout(res, 20));
  });
}

/** Mounts the providers, as a page load does, and lets the load effects finish. */
async function mount() {
  const r = renderHook(() => ({ list: useProjectList(), active: useActiveProject() }), { wrapper });
  await settle();
  return r;
}

beforeEach(async () => {
  localStorage.clear();
  driver = createLocalStorageDriver();
  for (const [id, name] of [['p1', 'One'], ['p2', 'Two'], ['p3', 'Three']]) {
    await driver.createProject(project(id, name));
  }
  driver.setActiveProjectId('p2');
});

describe('local mode: which project is open', () => {
  it('deleting the open project opens the first one left', async () => {
    const { result } = await mount();
    expect(result.current.active.project?.id).toBe('p2'); // fixture sanity
    await settle(() => result.current.list.deleteProject('p2'));
    expect(result.current.list.projects.map((p) => p.id)).toEqual(['p1', 'p3']);
    expect(result.current.list.activeProjectId).toBe('p1');
    expect(result.current.active.project?.id).toBe('p1');
    expect(localStorage.getItem(LS_ACTIVE_PROJECT)).toBe('p1');
  });

  it('deleting another project leaves the open one open', async () => {
    const { result } = await mount();
    await settle(() => result.current.list.deleteProject('p3'));
    expect(result.current.list.projects.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(result.current.list.activeProjectId).toBe('p2');
    expect(result.current.active.project?.id).toBe('p2');
  });

  it('a new project is still the open one after a reload', async () => {
    const first = await mount();
    let id = '';
    await act(async () => { id = await first.result.current.list.createProject('Four'); });
    first.unmount();

    const { result } = await mount();
    expect(result.current.list.activeProjectId).toBe(id);
    expect(result.current.active.project?.name).toBe('Four');
  });
});
