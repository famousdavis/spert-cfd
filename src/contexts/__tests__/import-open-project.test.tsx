// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom
//
// ActiveProjectContext takes a cloud-mode import that replaced the open
// project into its copy (v0.17.7). The end-to-end case, over the real SDK, is
// emulator-tests/import-replace-open.test.tsx; this file pins what the copy
// takes and which copy takes it, with useProjectList and the driver replaced.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import type { Project } from '@/types';

type ListState = {
  activeProjectId: string | null;
  projectUpdateKey: number;
  projects: Array<{ id: string; name: string }>;
  importedActiveProject: Project | null;
};
let list: ListState;

vi.mock('@/contexts/project-list-context', () => ({
  useProjectList: () => list,
}));

const loads = new Map<string, Promise<Project | null>>();
const mockDriver = {
  mode: 'cloud' as const,
  workspaceId: 'uid-alice',
  flush: vi.fn(),
  loadProject: vi.fn((id: string) => loads.get(id) ?? Promise.resolve(null)),
  saveProject: vi.fn((p: Project) => { void p; return Promise.resolve(); }),
  onProjectChange: vi.fn(() => () => {}),
};
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({ driver: mockDriver, mode: 'cloud' }),
}));

import { ActiveProjectProvider, useActiveProject } from '../active-project-context';

// ── Fixtures ──────────────────────────────────────────────────────────────────
/** A project as the cloud driver loads it: cloud metadata included. */
function stored(id: string, name: string): Project {
  return {
    id,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    workflow: [
      { id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 },
      { id: 'dev', name: 'In Dev', color: '#3b82f6', category: 'active', order: 1 },
      { id: 'done', name: 'Done', color: '#22c55e', category: 'done', order: 2 },
    ],
    snapshots: [{ date: '2026-01-05', counts: { backlog: 4, dev: 1, done: 0 } }],
    settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
    _version: '0.13.1',
    _originRef: 'uid-alice',
    _changeLog: [{ action: 'created', timestamp: '2026-01-01T00:00:00.000Z', actor: 'uid-alice' }],
    owner: 'uid-alice',
    members: { 'uid-alice': 'owner', 'uid-bob': 'editor' },
  };
}

/** The same project as an import file brings it back: no cloud metadata. */
function fromFile(id: string): Project {
  return {
    id,
    name: 'Imported',
    createdAt: '2025-06-01T00:00:00.000Z',
    updatedAt: '2025-06-02T00:00:00.000Z',
    workflow: [
      { id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 },
      { id: 'qa', name: 'QA', color: '#a855f7', category: 'active', order: 1 },
      { id: 'done', name: 'Done', color: '#22c55e', category: 'done', order: 2 },
    ],
    snapshots: [
      { date: '2026-03-02', counts: { backlog: 9, qa: 1, done: 3 } },
      { date: '2026-03-09', counts: { backlog: 7, qa: 2, done: 4 } },
    ],
    settings: { gridSortNewestFirst: false, showWipWarnings: false, metricsPeriod: { kind: 'all' } },
    _version: '0.17.6',
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ActiveProjectProvider>{children}</ActiveProjectProvider>
);

async function flush() {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

beforeEach(() => {
  vi.clearAllMocks();
  loads.clear();
  loads.set('p1', Promise.resolve(stored('p1', 'One')));
  list = {
    activeProjectId: 'p1',
    projectUpdateKey: 0,
    projects: [{ id: 'p1', name: 'One' }, { id: 'p2', name: 'Two' }],
    importedActiveProject: null,
  };
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('cloud mode: an import that replaced the open project', () => {
  it('is taken into the open copy, keeping what the save does not write', async () => {
    const r = renderHook(() => useActiveProject(), { wrapper });
    await flush();
    expect(r.result.current.project?.name).toBe('One'); // control: loaded

    const file = fromFile('p1');
    list = { ...list, projects: [{ id: 'p1', name: 'Imported' }, list.projects[1]], importedActiveProject: file };
    r.rerender();

    const copy = r.result.current.project;
    // What the cloud save writes comes from the file...
    expect(copy?.name).toBe('Imported');
    expect(copy?.workflow).toEqual(file.workflow);
    expect(copy?.snapshots).toEqual(file.snapshots);
    expect(copy?.settings).toEqual(file.settings);
    // ...and what it never writes stays as stored.
    const before = stored('p1', 'One');
    expect(copy?.createdAt).toBe(before.createdAt);
    expect(copy?.owner).toBe(before.owner);
    expect(copy?.members).toEqual(before.members);
    expect(copy?._changeLog).toEqual(before._changeLog);
    expect(copy?._originRef).toBe(before._originRef);

    // The next edit saves the import with it.
    act(() => r.result.current.updateSettings({ gridSortNewestFirst: true }));
    const saved = mockDriver.saveProject.mock.calls.at(-1)?.[0];
    expect(saved?.workflow).toEqual(file.workflow);
    expect(saved?.snapshots).toEqual(file.snapshots);
    expect(saved?.settings).toEqual({ ...file.settings, gridSortNewestFirst: true });
  });

  it('is never taken into the copy of another project, still open while it loads', async () => {
    const r = renderHook(() => useActiveProject(), { wrapper });
    await flush();

    // p2 is opened and has not loaded yet; an import replacing p2 arrives.
    let finishLoad: (p: Project) => void = () => {};
    loads.set('p2', new Promise<Project>((res) => { finishLoad = res; }));
    list = { ...list, activeProjectId: 'p2' };
    r.rerender();
    await flush();
    list = { ...list, importedActiveProject: fromFile('p2') };
    r.rerender();

    const copy = r.result.current.project;
    expect(copy?.id).toBe('p1'); // control: still the project being left
    expect(copy?.name).toBe('One');
    expect(copy?.workflow).toEqual(stored('p1', 'One').workflow);
    expect(copy?.snapshots).toEqual(stored('p1', 'One').snapshots);

    await act(async () => { finishLoad(stored('p2', 'Two')); });
    expect(r.result.current.project?.id).toBe('p2'); // control: p2 opens
  });
});
