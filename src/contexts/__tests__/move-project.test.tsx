// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.20.2 (DASH26 R2o, O53a): the Projects list's side of a drop. The driver
// gets the move, never a list; the tiles move at once; the list then shows the
// order written, or the order it had before the drop when nothing was written.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import type { MoveOutcome, ProjectMove, StorageDriver } from '@/lib/storage-driver';
import type { Project } from '@/types';

let driver: StorageDriver;
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({ driver, mode: driver.mode }),
}));

import { createLocalStorageDriver } from '@/lib/local-storage-driver';
import { ProjectListProvider, useProjectList } from '../project-list-context';

function project(id: string): Project {
  return {
    id,
    name: id.toUpperCase(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    workflow: [{ id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 }],
    snapshots: [],
    settings: { gridSortNewestFirst: false, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) => <ProjectListProvider>{children}</ProjectListProvider>;

async function settle(fn: () => unknown = () => {}) {
  await act(async () => {
    fn();
    await new Promise((res) => setTimeout(res, 20));
  });
}

async function mount() {
  const r = renderHook(() => useProjectList(), { wrapper });
  await settle();
  return r;
}

const shown = (r: { current: ReturnType<typeof useProjectList> }) => r.current.projects.map((p) => p.id).join(' ');

describe('local mode (the real driver; a second driver is another tab)', () => {
  beforeEach(async () => {
    localStorage.clear();
    driver = createLocalStorageDriver();
    for (const id of ['a', 'b', 'c']) await driver.createProject(project(id));
  });

  it('shows the order written, another tab\'s reorder included', async () => {
    const { result } = await mount();
    const other = createLocalStorageDriver();
    const all = ['a', 'b', 'c'];
    await other.moveProject({ draggedId: 'c', targetId: 'a', shownIds: all, heldIds: all }); // c a b
    await other.moveProject({ draggedId: 'b', targetId: 'a', shownIds: all, heldIds: all }); // c b a
    expect(shown(result)).toBe('a b c'); // this tab has not reloaded
    await settle(() => result.current.moveProject('a', 'b'));
    expect(shown(result)).toBe('c a b');
  });

  it('a drop naming a project another tab deleted is refused, and the list is as it was before the drop', async () => {
    const { result } = await mount();
    await createLocalStorageDriver().deleteProject('b');
    await settle(() => result.current.moveProject('b', 'a'));
    expect(shown(result)).toBe('a b c');
    expect(JSON.parse(localStorage.getItem('cfd-lab')!).projectIds).toEqual(['a', 'c']);
  });
});

describe('a driver that answers later', () => {
  const answers: Array<(o: MoveOutcome) => void> = [];
  const sent: ProjectMove[] = [];
  function slowDouble(fail = false): StorageDriver {
    const local = createLocalStorageDriver();
    return {
      ...local,
      mode: 'cloud',
      workspaceId: 'uid-me',
      onProjectListChange: () => () => {},
      moveProject: vi.fn((move: ProjectMove) => {
        sent.push(move);
        return fail ? Promise.reject(new Error('boom')) : new Promise<MoveOutcome>((resolve) => answers.push(resolve));
      }),
    };
  }

  beforeEach(async () => {
    localStorage.clear();
    answers.length = 0;
    sent.length = 0;
    driver = slowDouble();
    for (const id of ['a', 'b', 'c']) await createLocalStorageDriver().createProject(project(id));
  });

  it('sends the move and the ids held before it, never a final list, and moves the tiles at once', async () => {
    const { result } = await mount();
    await settle(() => result.current.moveProject('c', 'a'));
    expect(sent).toEqual([{ draggedId: 'c', targetId: 'a', shownIds: ['a', 'b', 'c'], heldIds: ['a', 'b', 'c'] }]);
    expect(shown(result)).toBe('c a b');
  });

  for (const kind of ['unread', 'refused', 'failed', 'unchanged'] as const) {
    it(`${kind}: the list shows the order it had before the drop`, async () => {
      const { result } = await mount();
      await settle(() => result.current.moveProject('c', 'a'));
      expect(shown(result)).toBe('c a b');
      await settle(() => answers[0]({ kind }));
      expect(shown(result)).toBe('a b c');
    });
  }

  it('a rejected move is shown as nothing written', async () => {
    driver = slowDouble(true);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await mount();
    await settle(() => result.current.moveProject('c', 'a'));
    expect(shown(result)).toBe('a b c');
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it('two quick drops: the first one\'s answer never shows the second undone', async () => {
    const { result } = await mount();
    await settle(() => result.current.moveProject('c', 'a')); // c a b
    await settle(() => result.current.moveProject('b', 'c')); // b c a
    expect(shown(result)).toBe('b c a');
    expect(sent[1].heldIds).toEqual(['c', 'a', 'b']);
    await settle(() => answers[0]({ kind: 'written', order: ['c', 'a', 'b'] }));
    expect(shown(result)).toBe('b c a');
    await settle(() => answers[1]({ kind: 'written', order: ['b', 'c', 'a'] }));
    expect(shown(result)).toBe('b c a');
  });

  it('the first of two drops refused: the second stays, made on the order before the first', async () => {
    const { result } = await mount();
    await settle(() => result.current.moveProject('c', 'a')); // c a b
    await settle(() => result.current.moveProject('b', 'c')); // b c a
    await settle(() => answers[0]({ kind: 'unread' }));
    expect(shown(result)).toBe('a c b'); // b onto c, made in a b c
  });

  it('a listed project the order written does not name is shown last (PR #114 review -06, M4)', async () => {
    const { result } = await mount();
    await settle(() => result.current.moveProject('b', 'a'));
    expect(shown(result)).toBe('b a c');
    await settle(() => answers[0]({ kind: 'written', order: ['b', 'a'] })); // c: not in the order, as an unordered cloud project
    expect(shown(result)).toBe('b a c');
    await settle(() => result.current.moveProject('a', 'b'));
    await settle(() => answers[1]({ kind: 'written', order: ['a', 'b'] }));
    expect(shown(result)).toBe('a b c');
  });

  it('shows the order written, which may differ from the drop made on the tab\'s own order', async () => {
    const { result } = await mount();
    await settle(() => result.current.moveProject('a', 'b'));
    expect(shown(result)).toBe('b a c');
    await settle(() => answers[0]({ kind: 'written', order: ['x', 'c', 'a', 'b'] })); // x: a project this tab does not list
    expect(shown(result)).toBe('c a b');
  });
});

// PR #114 review -01 (Opus-PR114-1, its probe adopted): a cloud drop still
// waiting for its answer (offline: until reconnect) when the driver is swapped,
// here by Switch to local with Keep local copy, so the ids are the same. Until
// the fix the waiting drop stayed in the list of drops to re-apply and was made
// again over every later drop's answer on the new driver, so the screen and the
// stored order disagreed until a reload.
describe('a driver swap with a cloud drop still waiting', () => {
  const index = () => (JSON.parse(localStorage.getItem('cfd-lab')!).projectIds as string[]).join(' ');

  it('the waiting drop is dropped with its driver: the screen and the stored order agree after every later drop', async () => {
    localStorage.clear();
    for (const id of ['a', 'b', 'c']) await createLocalStorageDriver().createProject(project(id));
    const answers: Array<(o: MoveOutcome) => void> = [];
    driver = {
      ...createLocalStorageDriver(),
      mode: 'cloud',
      workspaceId: 'uid-me',
      onProjectListChange: () => () => {},
      moveProject: vi.fn((_m: ProjectMove) => new Promise<MoveOutcome>((resolve) => answers.push(resolve))),
    };
    const r = renderHook(() => useProjectList(), { wrapper });
    await settle();
    await settle(() => r.result.current.moveProject('c', 'a')); // offline cloud drop: waiting
    expect(shown(r.result)).toBe('c a b');

    driver = createLocalStorageDriver(); // Switch to local, Keep local copy (stored a b c)
    await settle(() => r.rerender());
    expect(shown(r.result)).toBe('a b c');

    await settle(() => r.result.current.moveProject('b', 'a'));
    expect([shown(r.result), index()]).toEqual(['b a c', 'b a c']);

    await settle(() => answers[0]({ kind: 'written', order: ['c', 'a', 'b'] })); // the old write lands on reconnect
    expect([shown(r.result), index()]).toEqual(['b a c', 'b a c']);

    await settle(() => r.result.current.moveProject('a', 'c'));
    expect([shown(r.result), index()]).toEqual(['b c a', 'b c a']);
  });

  it('after a swap, a refused drop springs back to the new driver\'s list, not the old driver\'s order', async () => {
    localStorage.clear();
    for (const id of ['a', 'b', 'c']) await createLocalStorageDriver().createProject(project(id));
    driver = {
      ...createLocalStorageDriver(),
      mode: 'cloud',
      workspaceId: 'uid-me',
      onProjectListChange: () => () => {},
      moveProject: vi.fn(() => new Promise<MoveOutcome>(() => {})),
    };
    const r = renderHook(() => useProjectList(), { wrapper });
    await settle();
    await settle(() => r.result.current.moveProject('c', 'a')); // waiting for ever
    const local = createLocalStorageDriver();
    const all = ['a', 'b', 'c'];
    await local.moveProject({ draggedId: 'b', targetId: 'a', shownIds: all, heldIds: all }); // stored b a c
    driver = local;
    await settle(() => r.rerender());
    expect(shown(r.result)).toBe('b a c');
    await createLocalStorageDriver().deleteProject('c'); // another tab
    await settle(() => r.result.current.moveProject('c', 'b')); // names a deleted project: refused
    expect(shown(r.result)).toBe('b a c');
  });
});
