// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom
//
// v0.19.0 (DASH26 R1b): ProjectListContext.cloneProject. Local half: the real
// providers over the real local driver and jsdom's localStorage. Cloud half: a
// cloud-mode driver double that records what it is asked to create (the
// emulator tier runs the real cloud driver: emulator-tests/clone.test.ts).
// - P4 fields: an allowlist; a local clone stores none of the six cloud fields
//   even when its source (a kept local copy of a cloud project) carries them.
// - P4 names: "X (copy)", "X (copy 2)" with "x (copy)" taken; a 200-character
//   source.
// - O22 (e): local placement with an unreadable id in the index.
// - O18: the open project and the active key stay as they were.
// - O19 / O24: a refused save leaves no tile and no stored data.
// - O23 (amended after PR #109 review -08): in cloud, Clone, Create and Load
//   Sample are listed as the person's own once the create has landed, not
//   before (the document may not exist on the server yet).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import type { StorageDriver } from '@/lib/storage-driver';
import type { Project } from '@/types';

let driver: StorageDriver;
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({ driver, mode: driver.mode }),
}));

import { createLocalStorageDriver } from '@/lib/local-storage-driver';
import { LS_ACTIVE_PROJECT, MAX_NAME_LENGTH } from '@/lib/constants';
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
      { id: 'done', name: 'Done', color: '#22c55e', category: 'done', order: 1 },
    ],
    snapshots: [{ date: '2026-06-01', counts: { backlog: 5, done: 1 } }],
    settings: { gridSortNewestFirst: false, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ProjectListProvider>
    <ActiveProjectProvider>{children}</ActiveProjectProvider>
  </ProjectListProvider>
);

async function settle(fn: () => unknown = () => {}) {
  await act(async () => {
    fn();
    await new Promise((res) => setTimeout(res, 20));
  });
}

async function mount() {
  const r = renderHook(() => ({ list: useProjectList(), active: useActiveProject() }), { wrapper });
  await settle();
  return r;
}

const stored = (id: string) => JSON.parse(localStorage.getItem(`cfd-lab-project-${id}`) ?? 'null');
const index = () => JSON.parse(localStorage.getItem('cfd-lab')!).projectIds as string[];

describe('Clone, local mode (real driver)', () => {
  beforeEach(async () => {
    localStorage.clear();
    driver = createLocalStorageDriver();
    for (const [id, name] of [['p1', 'One'], ['p2', 'Two'], ['p3', 'Three']]) await driver.createProject(project(id, name));
    driver.setActiveProjectId('p2');
  });

  it('copies the content by an allowlist: a local clone stores none of the six cloud fields its source carries', async () => {
    // A kept local copy of a cloud project carries all six (cloud-storage-modal.tsx's Keep Local Copy).
    const kept = {
      ...project('p1', 'One'),
      owner: 'uid-owner', members: { 'uid-owner': 'owner' as const }, schemaVersion: '0.7.0',
      _originRef: 'uid-owner', _storageRef: 'ws-x', _changeLog: [{ action: 'created' as const, timestamp: 't', actor: 'uid-owner' }],
    };
    localStorage.setItem('cfd-lab-project-p1', JSON.stringify(kept));
    const { result } = await mount();
    const before = Date.now();
    let made = { id: '', name: '' };
    await settle(async () => { made = await result.current.list.cloneProject((await driver.loadProject('p1'))!); });
    const clone = stored(made.id);
    expect(made.id).not.toBe('p1');
    expect(made.id).toMatch(/^[A-Za-z0-9_-]{8}$/);
    expect(clone.name).toBe('One (copy)');
    expect(clone.workflow).toEqual(kept.workflow);
    expect(clone.snapshots).toEqual(kept.snapshots);
    expect(clone.settings).toEqual(kept.settings);
    for (const field of ['owner', 'members', 'schemaVersion', '_originRef', '_storageRef', '_changeLog']) {
      expect(clone).not.toHaveProperty(field);
    }
    expect(Date.parse(clone.createdAt)).toBeGreaterThanOrEqual(before - 1);
    expect(Date.parse(clone.updatedAt)).toBeGreaterThanOrEqual(before - 1);
  });

  it('is on screen at once, right after its source, and stored there (O22)', async () => {
    const { result } = await mount();
    let pending!: Promise<{ id: string; name: string }>;
    act(() => { pending = result.current.list.cloneProject(project('p1', 'One')); });
    // Before the save settles:
    expect(result.current.list.projects.map((p) => p.name)).toEqual(['One', 'One (copy)', 'Two', 'Three']);
    let made = { id: '', name: '' };
    await settle(async () => { made = await pending; });
    expect(index()).toEqual(['p1', made.id, 'p2', 'p3']);
  });

  it('O22 (e): placement works with an unreadable id in the index, which stays where it is', async () => {
    localStorage.setItem('cfd-lab-project-bad00000', JSON.stringify({ ...project('bad00000', 'Bad'), workflow: [] }));
    localStorage.setItem('cfd-lab', JSON.stringify({ ...JSON.parse(localStorage.getItem('cfd-lab')!), projectIds: ['p1', 'bad00000', 'p2', 'p3'] }));
    const { result } = await mount();
    expect(result.current.list.projects.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']); // fixture: bad is not listed
    let made = { id: '', name: '' };
    await settle(async () => { made = await result.current.list.cloneProject(project('p1', 'One')); });
    expect(index()).toEqual(['p1', made.id, 'bad00000', 'p2', 'p3']);
  });

  it('O18: the open project, the active id and the active key stay as they were', async () => {
    const { result } = await mount();
    expect(result.current.active.project?.id).toBe('p2'); // fixture sanity
    await settle(async () => { await result.current.list.cloneProject(project('p1', 'One')); });
    expect(result.current.list.activeProjectId).toBe('p2');
    expect(result.current.active.project?.id).toBe('p2');
    expect(localStorage.getItem(LS_ACTIVE_PROJECT)).toBe('p2');
  });

  it('names: "X (copy)" then "X (copy 2)" with "x (copy)" taken, in another case; the copy goes right after its source', async () => {
    await driver.createProject(project('p4', 'ONE (COPY)'));
    const { result } = await mount();
    let made = { id: '', name: '' };
    await settle(async () => { made = await result.current.list.cloneProject(project('p1', 'One')); });
    expect(made.name).toBe('One (copy 2)');
    expect(result.current.list.projects.map((p) => p.name)).toEqual(['One', 'One (copy 2)', 'Two', 'Three', 'ONE (COPY)']);
  });

  it('G2: two clones started in one run are named against the list as it is when each is added: "X (copy)", then "X (copy 2)"', async () => {
    const { result } = await mount();
    let first!: Promise<{ id: string; name: string }>;
    let second!: Promise<{ id: string; name: string }>;
    act(() => {
      first = result.current.list.cloneProject(project('p1', 'One'));
      second = result.current.list.cloneProject(project('p1', 'One'));
    });
    let names: string[] = [];
    await settle(async () => { names = [(await first).name, (await second).name]; });
    expect(names).toEqual(['One (copy)', 'One (copy 2)']);
    expect(result.current.list.projects.map((p) => p.name)).toEqual(['One', 'One (copy 2)', 'One (copy)', 'Two', 'Three']);
  });

  it('names: a 200-character source keeps the name within the limit, and the copy stays readable after a reload', async () => {
    const long = 'L'.repeat(MAX_NAME_LENGTH);
    await driver.createProject(project('p9', long));
    const first = await mount();
    let made = { id: '', name: '' };
    await settle(async () => { made = await first.result.current.list.cloneProject((await driver.loadProject('p9'))!); });
    expect(made.name.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
    expect(made.name.endsWith(' (copy)')).toBe(true);
    first.unmount();
    const { result } = await mount();
    expect(result.current.list.projects.some((p) => p.id === made.id)).toBe(true);
  });

  it('storage full: the clone is refused, no tile is left, nothing is stored, and the open project stays', async () => {
    const { result } = await mount();
    const setItem = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key.startsWith('cfd-lab-project-')) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      return setItem.call(this, key, value);
    });
    let outcome = '';
    await settle(async () => {
      outcome = await result.current.list.cloneProject(project('p1', 'One')).then(() => 'resolved', (e: Error) => `rejected:${e.name}`);
    });
    spy.mockRestore();
    expect(outcome).toBe('rejected:QuotaExceededError');
    expect(result.current.list.projects.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(index()).toEqual(['p1', 'p2', 'p3']);
    expect(result.current.list.activeProjectId).toBe('p2');
  });
});

describe('Clone, Create and Load Sample, cloud mode (a recording double)', () => {
  const created: Array<{ project: Project; placement: unknown }> = [];
  function cloudDouble(): StorageDriver {
    return {
      mode: 'cloud',
      workspaceId: 'uid-me',
      loadProjectList: vi.fn(async () => [
        { id: 's1', name: 'Shared', owner: 'uid-other', role: 'viewer' as const, memberCount: 2 },
        { id: 'o1', name: 'Mine', owner: 'uid-me', role: 'owner' as const, memberCount: 1 },
      ]),
      loadProject: vi.fn(async (id: string) => project(id, id === 's1' ? 'Shared' : 'Mine')),
      createProject: vi.fn(async (p: Project, placement?: unknown) => { created.push({ project: p, placement }); }),
      saveProject: vi.fn(async () => {}),
      deleteProject: vi.fn(async () => {}),
      getActiveProjectId: vi.fn(() => null),
      setActiveProjectId: vi.fn(),
      moveProject: vi.fn(async () => ({ kind: 'unchanged' as const })),
      onProjectChange: vi.fn(() => () => {}),
      onProjectListChange: vi.fn(() => () => {}),
      exportProject: vi.fn(() => '{}'),
      importProject: vi.fn(() => null),
      flush: vi.fn(),
      cancelPendingSaves: vi.fn(),
      removeCollaborator: vi.fn(async () => {}),
      listPendingInvites: vi.fn(async () => []),
      revokeInvite: vi.fn(async () => {}),
      resendInvite: vi.fn(async () => {}),
    };
  }

  beforeEach(() => {
    localStorage.clear();
    created.length = 0;
    driver = cloudDouble();
  });

  it('a viewer\'s clone: exactly one history entry, \'cloned\', naming the source; placed after it; listed as the person\'s own', async () => {
    const { result } = await mount();
    let made = { id: '', name: '' };
    await settle(async () => { made = await result.current.list.cloneProject(project('s1', 'Shared')); });
    expect(created).toHaveLength(1);
    const { project: sent, placement } = created[0];
    expect(sent._changeLog).toEqual([{ action: 'cloned', actor: 'uid-me', detail: 's1', timestamp: sent.createdAt }]);
    for (const field of ['owner', 'members', 'schemaVersion', '_originRef', '_storageRef']) expect(sent).not.toHaveProperty(field);
    expect(placement).toEqual({ after: 's1', shownIds: ['s1', 'o1'] });
    expect(result.current.list.projects.find((p) => p.id === made.id)).toEqual({ id: made.id, name: 'Shared (copy)', owner: 'uid-me', role: 'owner', memberCount: 1 });
    expect(result.current.list.projects.map((p) => p.id)).toEqual(['s1', made.id, 'o1']);
  });

  it('on screen at once, after its source, while the create is still in flight (F10)', async () => {
    driver = { ...cloudDouble(), createProject: vi.fn(() => new Promise<void>(() => {})) };
    const { result } = await mount();
    act(() => { void result.current.list.cloneProject(project('s1', 'Shared')); });
    expect(result.current.list.projects.map((p) => p.name)).toEqual(['Shared', 'Shared (copy)', 'Mine']);
    expect(result.current.list.activeProjectId).toBeNull();
    expect(result.current.list.projects[1].role).toBeUndefined(); // not the person's own until it lands (O23 amended)
  });

  it('O23 (amended): Clone, Create and Load Sample are the person\'s own once the create lands, not while it is in flight', async () => {
    const land: Array<() => void> = [];
    driver = {
      ...cloudDouble(),
      createProject: vi.fn((p: Project, placement?: unknown) => {
        created.push({ project: p, placement });
        return new Promise<void>((resolve) => { land.push(resolve); });
      }),
    };
    const { result } = await mount();
    act(() => { void result.current.list.createProject('New'); });
    act(() => { void result.current.list.loadSampleProject(); });
    act(() => { void result.current.list.cloneProject(project('s1', 'Shared')); });
    const ids = created.map((c) => c.project.id);
    const item = (id: string) => result.current.list.projects.find((p) => p.id === id);
    expect(ids).toHaveLength(3);
    for (const id of ids) expect(item(id)).toEqual({ id, name: item(id)!.name }); // no owner, role or member count yet
    await settle(() => { for (const f of land) f(); });
    for (const id of ids) expect(item(id)).toMatchObject({ owner: 'uid-me', role: 'owner', memberCount: 1 });
    expect(created.map((c) => c.placement === undefined)).toEqual([true, true, false]);
    expect(created.slice(0, 2).every((c) => c.project._changeLog === undefined)).toBe(true);
  });

  it('an empty cloud list is never seeded', async () => {
    driver = { ...cloudDouble(), loadProjectList: vi.fn(async () => []) };
    const { result } = await mount();
    expect(result.current.list.projects).toEqual([]);
    expect(created).toEqual([]);
  });
});
