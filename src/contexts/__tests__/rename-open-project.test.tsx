// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom
//
// Renaming the open project, then editing it, must keep the new name.
//
// Two contexts write a project. ProjectListContext.renameProject reads the
// stored project and saves it under the new name; ActiveProjectContext saves
// its own in-memory copy, name included, on every edit. Before v0.17.6 that
// copy never learned the new name, so the next edit (Add Row, a settings
// toggle, a workflow change) wrote the old name back over the rename, in both
// storage modes, and the card showed the old name after a reload.
//
// The real ProjectListProvider and ActiveProjectProvider over the real local
// driver (jsdom's localStorage) and the real Firestore driver. Only
// useStorage is replaced, to hand them the driver, and `firebase/firestore`
// is mocked with a small server for the cloud cases.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import type { StorageDriver } from '@/lib/storage-driver';
import type { Project } from '@/types';

// ── A small Firestore server behind the SDK seam ──────────────────────────────
// What matters here, as the SDK behaves: a listener on a project doc delivers
// the doc once it is read, and a remote change when pushed; it does not echo
// this client's own writes back (the driver skips hasPendingWrites, and an
// acknowledgement alone fires no event without includeMetadataChanges).
const UID = 'uid-alice';
const PROJECTS = 'spertcfd_projects';
const RTT_MS = 10;

type Data = Record<string, unknown>;
type Ref = { path: string; id: string; col: string };
type DocListener = { path: string; next: (s: unknown) => void };

let server: Map<string, Data>;
let docListeners: DocListener[];

const later = <T,>(fn: () => T) => new Promise<T>((res) => setTimeout(() => res(fn()), RTT_MS));
const snapOf = (ref: Ref, data: Data | undefined) => ({
  id: ref.id,
  exists: () => data !== undefined,
  data: () => data,
  metadata: { hasPendingWrites: false },
});

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string): Ref => ({ path: `${col}/${id}`, id, col }),
  collection: (_db: unknown, col: string) => ({ col }),
  where: () => ({}),
  query: (c: { col: string }) => ({ _query: true, col: c.col }),
  arrayUnion: (...v: unknown[]) => ({ _arrayUnion: v }),
  arrayRemove: (...v: unknown[]) => ({ _arrayRemove: v }),
  deleteField: () => ({ _deleteField: true }),
  runTransaction: async () => {},
  deleteDoc: async () => {},
  getDocFromCache: async () => {
    throw Object.assign(new Error('Failed to get document from cache.'), { code: 'unavailable' });
  },
  getDocs: async () => {
    const docs = [...server.entries()]
      .filter(([path, d]) => path.startsWith(PROJECTS + '/') && (d.members as Data)?.[UID])
      .map(([path, d]) => ({ id: path.split('/')[1], data: () => d }));
    return { forEach: (cb: (d: unknown) => void) => docs.forEach(cb) };
  },
  getDoc: (ref: Ref) => later(() => snapOf(ref, server.get(ref.path))),
  setDoc: async (ref: Ref, data: Data, opts?: { mergeFields?: string[]; merge?: boolean }) => {
    if (ref.col !== PROJECTS) return;
    const prev = server.get(ref.path) ?? {};
    if (opts?.mergeFields) {
      const picked = Object.fromEntries(opts.mergeFields.map((f) => [f, data[f]]));
      server.set(ref.path, { ...prev, ...picked });
    } else {
      server.set(ref.path, opts?.merge ? { ...prev, ...data } : data);
    }
  },
  onSnapshot: (ref: Ref | { _query: true }, next: (s: unknown) => void) => {
    if ('_query' in ref) return () => {}; // project-list listener: silent here
    const listener = { path: ref.path, next };
    docListeners.push(listener);
    void later(() => {
      if (docListeners.includes(listener)) next(snapOf(ref, server.get(ref.path)));
    });
    return () => { docListeners = docListeners.filter((l) => l !== listener); };
  },
}));

let driver: StorageDriver;
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({ driver, mode: driver.mode }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import { createLocalStorageDriver } from '@/lib/local-storage-driver';
import { createFirestoreDriver } from '@/lib/firestore-driver';
import { LS_ACTIVE_PROJECT } from '@/lib/constants';
import { mergeSnapshots } from '@/lib/dates';
import { ProjectListProvider, useProjectList } from '../project-list-context';
import { ActiveProjectProvider, useActiveProject } from '../active-project-context';

// ── Fixtures ──────────────────────────────────────────────────────────────────
// The shape createProject builds: a project with an empty workflow is dropped
// on a local load and the provider seeds the sample project instead.
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
    snapshots: [{ date: '2026-01-05', counts: { backlog: 4, dev: 1, done: 0 } }],
    settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
  };
}

type Mode = {
  name: 'local' | 'cloud';
  /** A fresh driver over the same store, as a page load makes. */
  newDriver: () => StorageDriver;
  seed: (p: Project) => Promise<void>;
  /** What a reload would read: the project as stored. */
  stored: (id: string) => { name: unknown; snapshots: Array<{ date: string }>; settings: Data; workflow: unknown[] };
};

const LOCAL: Mode = {
  name: 'local',
  newDriver: () => createLocalStorageDriver(),
  seed: (p) => createLocalStorageDriver().createProject(p),
  stored: (id) => JSON.parse(localStorage.getItem(`cfd-lab-project-${id}`) ?? 'null'),
};

const CLOUD: Mode = {
  name: 'cloud',
  newDriver: () => createFirestoreDriver(UID, {} as Parameters<typeof createFirestoreDriver>[1]),
  seed: async (p) => {
    const { id, ...data } = p;
    server.set(`${PROJECTS}/${id}`, { ...data, owner: UID, members: { [UID]: 'owner' } });
  },
  stored: (id) => server.get(`${PROJECTS}/${id}`) as ReturnType<Mode['stored']>,
};

// ── Harness ───────────────────────────────────────────────────────────────────
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ProjectListProvider>
    <ActiveProjectProvider>{children}</ActiveProjectProvider>
  </ProjectListProvider>
);

// React holds renders scheduled inside an async act() until its callback
// resolves, so the wait is several short scopes: each render, effect and
// reply takes its turn. 300 ms is past the cloud save debounce (200 ms).
async function settle(ms = 300) {
  for (let waited = 0; waited < ms; waited += 25) {
    await act(async () => { await new Promise((r) => setTimeout(r, 25)); });
  }
}

/** Mounts the providers, as a page load does, and lets the loads finish. */
async function mount() {
  const r = renderHook(() => ({ list: useProjectList(), active: useActiveProject() }), { wrapper });
  await settle();
  return r;
}

type Hook = Awaited<ReturnType<typeof mount>>;

/** Unmounts and mounts again over a fresh driver: what a reload shows. */
async function reload(r: Hook, mode: Mode) {
  r.unmount();
  driver = mode.newDriver();
  return mount();
}

const NEW_DATE = '2026-02-02';

/** The edits ActiveProjectContext saves, as the UI makes them. */
const EDITS = [
  {
    what: 'Add Row (updateSnapshots)',
    run: (r: Hook) => {
      const { snapshots, updateSnapshots } = r.result.current.active;
      updateSnapshots(mergeSnapshots(snapshots, [{ date: NEW_DATE, counts: { backlog: 3, dev: 2, done: 1 } }]));
    },
    landed: (s: ReturnType<Mode['stored']>) => s.snapshots.some((x) => x.date === NEW_DATE),
  },
  {
    what: 'the grid sort toggle (updateSettings)',
    run: (r: Hook) => r.result.current.active.updateSettings({ gridSortNewestFirst: false }),
    landed: (s: ReturnType<Mode['stored']>) => s.settings.gridSortNewestFirst === false,
  },
  {
    what: 'a workflow edit (updateWorkflow)',
    run: (r: Hook) => {
      const { workflow, updateWorkflow } = r.result.current.active;
      updateWorkflow([...workflow, { id: 'qa', name: 'QA', color: '#a855f7', category: 'active', order: 3 }]);
    },
    landed: (s: ReturnType<Mode['stored']>) => s.workflow.length === 4,
  },
];

beforeEach(() => {
  localStorage.clear();
  server = new Map();
  docListeners = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe.each([LOCAL, CLOUD])('$name mode: renaming the open project', (mode) => {
  beforeEach(async () => {
    await mode.seed(project('p1', 'One'));
    await mode.seed(project('p2', 'Two'));
    localStorage.setItem(LS_ACTIVE_PROJECT, 'p2');
    driver = mode.newDriver();
  });

  it.each(EDITS)('keeps the new name when the next edit is $what', async (edit) => {
    const r = await mount();
    expect(r.result.current.active.project?.name).toBe('Two'); // fixture sanity

    act(() => r.result.current.list.renameProject('p2', 'Two, renamed'));
    await settle();
    expect(mode.stored('p2').name).toBe('Two, renamed'); // control: the rename saved

    act(() => edit.run(r));
    await settle();
    expect(edit.landed(mode.stored('p2'))).toBe(true); // control: the edit saved
    expect(mode.stored('p2').name).toBe('Two, renamed');

    const after = await reload(r, mode);
    expect(after.result.current.list.projects.find((p) => p.id === 'p2')?.name).toBe('Two, renamed');
    expect(after.result.current.active.project?.name).toBe('Two, renamed');
  });

  it('an edit, then a rename: the rename saves last and keeps the edit', async () => {
    const r = await mount();
    act(() => EDITS[0].run(r));
    await settle();
    act(() => r.result.current.list.renameProject('p2', 'Two, renamed'));
    await settle();
    expect(mode.stored('p2').name).toBe('Two, renamed');
    expect(EDITS[0].landed(mode.stored('p2'))).toBe(true);
  });

  it('renaming another project leaves the open one, and its name, as they were', async () => {
    const r = await mount();
    act(() => r.result.current.list.renameProject('p1', 'One, renamed'));
    await settle();
    act(() => EDITS[0].run(r));
    await settle();
    expect(r.result.current.active.project?.id).toBe('p2');
    expect(mode.stored('p2').name).toBe('Two');
    expect(mode.stored('p1').name).toBe('One, renamed');
  });

  it('switching projects never gives the one being left the name of the one being opened', async () => {
    const r = await mount();
    act(() => r.result.current.list.switchProject('p1'));
    // The list already names p1 as open; p1 has not loaded yet.
    const shown = r.result.current.active.project;
    expect(shown?.id).toBe('p2'); // control: still the project being left
    expect(shown?.name).toBe('Two');
    await settle();
    expect(r.result.current.active.project?.name).toBe('One');
  });

  it('the new name is still kept after the open project is switched away and back', async () => {
    const r = await mount();
    act(() => r.result.current.list.renameProject('p2', 'Two, renamed'));
    await settle();
    act(() => r.result.current.list.switchProject('p1'));
    await settle();
    act(() => r.result.current.list.switchProject('p2'));
    await settle();
    act(() => EDITS[0].run(r));
    await settle();
    expect(mode.stored('p2').name).toBe('Two, renamed');
  });
});

describe('cloud mode: a name another editor gives the open project', () => {
  beforeEach(async () => {
    await CLOUD.seed(project('p2', 'Two'));
    localStorage.setItem(LS_ACTIVE_PROJECT, 'p2');
    driver = CLOUD.newDriver();
  });

  it('is kept by the next edit, although the project list has not caught up', async () => {
    const r = await mount();
    // Another editor renames the project: the doc listener delivers it; the
    // list listener has not (it is silent here), so the card still says Two.
    const path = `${PROJECTS}/p2`;
    server.set(path, { ...server.get(path), name: 'Two, by Bob' });
    act(() => {
      for (const l of docListeners.filter((x) => x.path === path)) {
        l.next(snapOf({ path, id: 'p2', col: PROJECTS }, server.get(path)));
      }
    });
    await settle();
    expect(r.result.current.active.project?.name).toBe('Two, by Bob'); // control: delivered
    expect(r.result.current.list.projects[0].name).toBe('Two'); // control: list behind

    act(() => EDITS[0].run(r));
    await settle();
    expect(CLOUD.stored('p2').name).toBe('Two, by Bob');
  });
});
