// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom
//
// v0.19.0 (DASH26 PR #109 review -01, G1): an edit refused at full storage stays
// in memory (R25) and must survive the next thing the alert invites on the
// Projects tab. A New Project or Load Sample refused at full storage used to
// make the new project active first; the refusal's rollback then restored the
// previous id, and ActiveProjectProvider reloaded that project FROM STORAGE,
// without the kept edit. The local driver refuses synchronously, so addProject
// now rejects before it activates or inserts anything. The reviewer's probe
// (`rev-pr109/opus-pr109-1-work/zz-opus-probe-kept-edit.test.tsx`), kept as
// the regression test; it failed at d454227 for Create and Load Sample.
// Real providers, real local driver, jsdom's localStorage.
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import type { StorageDriver } from '@/lib/storage-driver';
import type { Project } from '@/types';

let driver: StorageDriver;
vi.mock('@/contexts/storage-context', () => ({ useStorage: () => ({ driver, mode: driver.mode }) }));

import { createLocalStorageDriver } from '@/lib/local-storage-driver';
import { ProjectListProvider, useProjectList } from '../project-list-context';
import { ActiveProjectProvider, useActiveProject } from '../active-project-context';

const project = (id: string, name: string): Project => ({
  id, name, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  workflow: [{ id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 }, { id: 'done', name: 'Done', color: '#22c55e', category: 'done', order: 1 }],
  snapshots: [], settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
});
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ProjectListProvider><ActiveProjectProvider>{children}</ActiveProjectProvider></ProjectListProvider>
);
const settle = (fn: () => unknown = () => {}) => act(async () => { fn(); await new Promise((r) => setTimeout(r, 20)); });

afterEach(() => vi.restoreAllMocks());

beforeEach(async () => {
  localStorage.clear();
  driver = createLocalStorageDriver();
  await driver.createProject(project('p1', 'One'));
  driver.setActiveProjectId('p1');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

for (const action of ['createProject', 'loadSampleProject', 'cloneProject (control)'] as const) {
  it(`an edit refused at full storage survives a refused ${action}: still open, still in memory, nothing listed`, async () => {
    const { result } = renderHook(() => ({ list: useProjectList(), active: useActiveProject() }), { wrapper });
    await settle();
    expect(result.current.active.project?.id).toBe('p1');
    const setItem = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k.startsWith('cfd-lab-project-')) throw new DOMException('full', 'QuotaExceededError');
      return setItem.call(this, k, v);
    });
    await settle(() => result.current.active.updateSnapshots([{ date: '2030-01-01', counts: { backlog: 1, done: 0 } }]));
    expect(result.current.active.storageFull).toBe(true);
    expect(result.current.active.snapshots.map((s) => s.date)).toEqual(['2030-01-01']); // kept (R25)
    // As a click does: the add's own state updates commit (a discrete event), then its refusal settles.
    let p!: Promise<unknown>;
    act(() => {
      p = action === 'createProject' ? result.current.list.createProject('New')
        : action === 'loadSampleProject' ? result.current.list.loadSampleProject()
          : result.current.list.cloneProject(result.current.active.project!);
    });
    // Nothing was listed or activated, even for a moment.
    expect(result.current.list.projects.map((x) => x.id)).toEqual(['p1']);
    expect(result.current.list.activeProjectId).toBe('p1');
    let outcome = '';
    await settle(async () => { outcome = await p.then(() => 'resolved', (e: Error) => `rejected:${e.name}`); });
    spy.mockRestore();
    expect(outcome).toBe('rejected:QuotaExceededError');
    expect(result.current.active.project?.id).toBe('p1');
    expect(result.current.active.snapshots.map((s) => s.date)).toEqual(['2030-01-01']);
    expect(result.current.active.storageFull).toBe(true);
  });
}
