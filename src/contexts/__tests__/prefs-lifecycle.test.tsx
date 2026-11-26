// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.21.0 (DASH26 R2, O55): what Clone, Delete and Import do to the person's
// tile colour and archive, over the real local driver (and a cloud double for
// a refused delete). Raw documents in Cloud Storage: emulator-tests/project-prefs.test.ts.
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
import { LS_PROJECT_PREFS } from '@/lib/constants';
import { buildBannerText, type ImportConflict } from '@/lib/import-utils';
import { ProjectListProvider, useProjectList } from '../project-list-context';

function project(id: string, name: string): Project {
  return {
    id,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    workflow: [{ id: 'bl', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 }],
    snapshots: [],
    settings: { gridSortNewestFirst: false, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
  };
}
const wrapper = ({ children }: { children: React.ReactNode }) => <ProjectListProvider>{children}</ProjectListProvider>;
async function settle(fn: () => unknown = () => {}) {
  await act(async () => {
    await fn();
    await new Promise((res) => setTimeout(res, 20));
  });
}
const stored = () => JSON.parse(localStorage.getItem(LS_PROJECT_PREFS) ?? 'null');

beforeEach(async () => {
  localStorage.clear();
  driver = createLocalStorageDriver();
  for (const [id, name] of [['a', 'Alpha'], ['b', 'Bravo']]) await driver.createProject(project(id, name));
  localStorage.setItem(LS_PROJECT_PREFS, JSON.stringify({ a: { color: 'purple', archived: true } }));
  driver = createLocalStorageDriver(); // reads the map above
});

async function mount() {
  const r = renderHook(() => useProjectList(), { wrapper });
  await settle();
  return r;
}

describe('Clone', () => {
  it('the copy takes the source\'s colour, never its archive', async () => {
    const { result } = await mount();
    let made = { id: '', name: '' };
    await settle(async () => {
      made = await result.current.cloneProject(project('a', 'Alpha'));
    });
    expect(stored()).toEqual({ a: { color: 'purple', archived: true }, [made.id]: { color: 'purple' } });
  });

  it('a source with no colour gives an uncoloured copy, writing nothing', async () => {
    const { result } = await mount();
    await settle(() => result.current.cloneProject(project('b', 'Bravo')));
    expect(stored()).toEqual({ a: { color: 'purple', archived: true } });
  });
});

describe('names read the full list (O61)', () => {
  it('Clone names its copy against archived projects too', async () => {
    const seed = createLocalStorageDriver();
    await seed.createProject(project('ac', 'Alpha (copy)'));
    localStorage.setItem(LS_PROJECT_PREFS, JSON.stringify({ ac: { archived: true } }));
    driver = createLocalStorageDriver();
    const { result } = await mount();
    let made = { id: '', name: '' };
    await settle(async () => {
      made = await result.current.cloneProject(project('a', 'Alpha'));
    });
    expect(made.name).toBe('Alpha (copy 2)');
  });
});

describe('Delete', () => {
  it('drops the entry once the delete is made, both fields', async () => {
    const { result } = await mount();
    await settle(() => result.current.deleteProject('a'));
    expect(stored()).toBeNull();
  });

  it('PR #115 review (Opus-PR115-1 -04): drops both fields whatever this tab knows: an entry another tab set is gone too', async () => {
    const { result } = await mount();
    expect(driver.getProjectPrefs()).toEqual({ status: 'ready', prefs: { a: { color: 'purple', archived: true } } }); // this tab's map, read
    const otherTab = createLocalStorageDriver();
    expect(otherTab.setProjectPref('b', 'archived', true)).toBeNull();
    expect(otherTab.setProjectPref('b', 'color', 'teal')).toBeNull();
    await settle(() => result.current.deleteProject('b'));
    expect(stored()).toEqual({ a: { color: 'purple', archived: true } });
  });

  it('PR #115 review (Opus-PR115-1 -08): deleting the open project opens the first project not archived, not an archived one', async () => {
    await driver.createProject(project('c', 'Charlie'));
    const { result } = await mount();
    expect(result.current.projects.map((p) => p.id)).toEqual(['a', 'b', 'c']); // a is archived
    await settle(() => result.current.switchProject('b'));
    await settle(() => result.current.deleteProject('b'));
    expect(result.current.activeProjectId).toBe('c');
    expect(localStorage.getItem('spertcfd-active-project')).toBe('c');
  });

  it('deleting the open project with only archived ones left opens the first of them (R35: an archived project may be open)', async () => {
    const { result } = await mount();
    await settle(() => result.current.switchProject('b'));
    await settle(() => result.current.deleteProject('b'));
    expect(result.current.activeProjectId).toBe('a');
  });

  it('a delete the driver refuses keeps the entry', async () => {
    const local = driver;
    driver = { ...local, deleteProject: vi.fn(() => Promise.reject(Object.assign(new Error('no'), { code: 'permission-denied' }))) };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await mount();
    await settle(() => result.current.deleteProject('a'));
    expect(stored()).toEqual({ a: { color: 'purple', archived: true } });
  });
});

describe('Import keeps entries by id and names the projects it leaves archived', () => {
  it('a name-conflict Replace keeps the existing id, so its entry stays and it is named', async () => {
    const { result } = await mount();
    const incoming = { ...project('file-id', 'Alpha'), snapshots: [{ date: '2026-02-01', counts: { bl: 4 } }] };
    const conflicts: ImportConflict[] = [{ incoming, existing: { id: 'a', name: 'Alpha' }, type: 'name' }];
    let outcome: Awaited<ReturnType<typeof result.current.applyImportMerge>> | undefined;
    await settle(async () => {
      outcome = await result.current.applyImportMerge({ incoming: [incoming], decisions: new Map([['file-id', 'replace']]), originalConflicts: conflicts });
    });
    expect(outcome?.archivedNames).toEqual(['Alpha']);
    expect(buildBannerText(outcome!)).toBe('Replaced 1 project. "Alpha" is archived: Show archived lists it.');
    expect(stored()).toEqual({ a: { color: 'purple', archived: true } });
  });

  it('Add as Copy keeps the file\'s id, which can meet a stale entry: that copy is named too', async () => {
    localStorage.setItem(LS_PROJECT_PREFS, JSON.stringify({ a: { color: 'purple', archived: true }, 'old-id': { archived: true } }));
    driver = createLocalStorageDriver();
    const { result } = await mount();
    const incoming = project('old-id', 'Bravo');
    const conflicts: ImportConflict[] = [{ incoming, existing: { id: 'b', name: 'Bravo' }, type: 'name' }];
    let outcome: Awaited<ReturnType<typeof result.current.applyImportMerge>> | undefined;
    await settle(async () => {
      outcome = await result.current.applyImportMerge({ incoming: [incoming], decisions: new Map([['old-id', 'copy']]), originalConflicts: conflicts });
    });
    expect(outcome?.added).toBe(1);
    expect(outcome?.archivedNames).toEqual(['Bravo (copy)']);
  });

  it('nothing archived written: no names', async () => {
    const { result } = await mount();
    let outcome: Awaited<ReturnType<typeof result.current.applyImportMerge>> | undefined;
    await settle(async () => {
      outcome = await result.current.applyImportMerge({ incoming: [project('n1', 'New')], decisions: new Map(), originalConflicts: [] });
    });
    expect(outcome?.archivedNames).toBeUndefined();
  });
});
