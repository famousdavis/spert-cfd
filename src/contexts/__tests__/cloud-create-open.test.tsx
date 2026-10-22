// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import type { StorageDriver } from '@/lib/storage-driver';

// ── A tiny Firestore server behind the SDK seam ───────────────────────────────
// Only `firebase/firestore` is mocked. The driver, both contexts and their
// effects are the real code, so this test is indifferent to WHERE a fix lives.
//
// The server model is what the emulator measured against the landing-page
// rules (QC26 Q01): a project doc exists only once its create has LANDED; a
// get or a listen on a doc the server does not hold is denied
// (`isCfdMember(resource.data)` with resource null), and the denial arrives
// one round trip later. getDoc and onSnapshot on one doc failed together in
// 10/10 emulator trials, because the SDK serves both from one watch target.
// The local cache holds a pending create, and any save queued behind it, from
// the moment it is written (getDocFromCache: 10/10 online and offline).

const UID = 'uid-alice';
const PROJECTS = 'spertcfd_projects';
const RTT_MS = 20;

type Data = Record<string, unknown>;
type Ref = { path: string; id: string; col: string };
type PendingCreate = { path: string; data: Data; view: Data; resolve: () => void; reject: (e: unknown) => void };

let server: Map<string, Data>;
let landInstantly: boolean;
let rejectCreates: boolean;
let rejectOrderAppend: boolean;
let pendingCreates: PendingCreate[];
let writes: Array<{ path: string; merge: boolean }>;

const denied = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
const later = (fn: () => void) => setTimeout(fn, RTT_MS);
const docSnap = (ref: Ref, data: Data | undefined, hasPendingWrites = false) => ({
  id: ref.id,
  exists: () => data !== undefined,
  data: () => data,
  metadata: { hasPendingWrites },
});

function isProjectDoc(ref: Ref) {
  return ref.col === PROJECTS;
}

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string): Ref => ({ path: `${col}/${id}`, id, col }),
  collection: (_db: unknown, col: string) => ({ col }),
  where: () => ({}),
  query: (c: { col: string }) => ({ _query: true, col: c.col }),
  arrayUnion: (...v: unknown[]) => ({ _arrayUnion: v }),
  arrayRemove: (...v: unknown[]) => ({ _arrayRemove: v }),
  deleteField: () => ({ _deleteField: true }),
  runTransaction: vi.fn(),
  deleteDoc: vi.fn(async () => {}),
  getDocs: async () => {
    const docs = [...server.entries()]
      .filter(([path, d]) => path.startsWith(PROJECTS + '/') && (d.members as Data)?.[UID])
      .map(([path, d]) => ({ id: path.split('/')[1], data: () => d }));
    return { forEach: (cb: (d: unknown) => void) => docs.forEach(cb) };
  },
  getDoc: (ref: Ref) => {
    const data = server.get(ref.path);
    return new Promise((resolve, reject) => later(() => {
      // Settings doc: owner-only rule without a resource reference — a
      // missing doc reads as not-exists. Project doc: missing means denied.
      if (data === undefined && isProjectDoc(ref)) reject(denied());
      else resolve(docSnap(ref, data));
    }));
  },
  getDocFromCache: (ref: Ref) => {
    const pending = pendingCreates.find((p) => p.path === ref.path);
    if (pending) return Promise.resolve(docSnap(ref, pending.view, true));
    const landed = server.get(ref.path);
    return landed
      ? Promise.resolve(docSnap(ref, landed))
      : Promise.reject(Object.assign(new Error('Failed to get document from cache.'), { code: 'unavailable' }));
  },
  setDoc: (ref: Ref, data: Data, opts?: unknown) => {
    writes.push({ path: ref.path, merge: opts !== undefined });
    // spertcfd_settings/{uid}: the projectOrder append, written after the project lands.
    if (!isProjectDoc(ref)) return rejectOrderAppend ? Promise.reject(denied()) : Promise.resolve();
    if (opts !== undefined) {
      // A save: the SDK commits one client's writes in order, so a save
      // queued behind a pending create lands after it (measured on the
      // emulator), and the local cache shows it at once.
      const ahead = pendingCreates.find((p) => p.path === ref.path);
      const apply = () => { server.set(ref.path, { ...server.get(ref.path), ...data }); };
      if (!ahead) return Promise.resolve().then(apply);
      ahead.view = { ...ahead.view, ...data };
      return new Promise<void>((resolve) => { const r = ahead.resolve; ahead.resolve = () => { r(); apply(); resolve(); }; });
    }
    if (landInstantly) { server.set(ref.path, data); return Promise.resolve(); }
    return new Promise<void>((resolve, reject) => {
      pendingCreates.push({ path: ref.path, data, view: data, resolve, reject });
    });
  },
  onSnapshot: (ref: Ref | { _query: true }, next: (s: unknown) => void, error: (e: unknown) => void) => {
    if ('_query' in ref) return () => {}; // project-list listener: silent here
    let live = true;
    const data = server.get(ref.path);
    later(() => {
      if (!live) return;
      if (data === undefined) error(denied());
      else next(docSnap(ref, data));
    });
    return () => { live = false; };
  },
}));

let driver: StorageDriver;
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({ driver, mode: 'cloud' }),
}));

// ── Import after mocks ─────────────────────────────────────────────────────────
import { createFirestoreDriver } from '@/lib/firestore-driver';
import { ProjectListProvider, useProjectList } from '../project-list-context';
import { ActiveProjectProvider, useActiveProject } from '../active-project-context';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Lands every pending create (the server acknowledges the write). */
function land() {
  const batch = pendingCreates.splice(0);
  for (const p of batch) {
    if (rejectCreates) { p.reject(denied()); continue; }
    server.set(p.path, p.data);
    p.resolve();
  }
}

// React queues renders scheduled inside an async act() until its callback
// resolves, so one long act would hold every effect-triggered read back until
// the end. Several short scopes let each render, effect and reply take turns.
async function settle(rounds = 6) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, RTT_MS)); });
  }
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ProjectListProvider>
    <ActiveProjectProvider>{children}</ActiveProjectProvider>
  </ProjectListProvider>
);

async function mountWithProjectA() {
  const r = renderHook(() => ({ list: useProjectList(), active: useActiveProject() }), { wrapper });
  await settle();
  expect(r.result.current.active.project?.id).toBe('A'); // fixture sanity

  /** Types a name and presses Create: returns the new card's id and how the call ended. */
  function create(name = 'Beta') {
    let outcome: Promise<string> = Promise.resolve('not called');
    act(() => {
      // Promise.resolve() lets this run unchanged against the old
      // string-returning createProject, where these tests must fail.
      outcome = Promise.resolve(r.result.current.list.createProject(name)).then(
        () => 'resolved',
        (e: { code?: string; name?: string }) => 'rejected:' + (e.code ?? e.name),
      );
    });
    const id = r.result.current.list.projects.find((p) => p.name === name)?.id ?? '';
    return { id, outcome };
  }
  return { result: r.result, create };
}

beforeEach(() => {
  server = new Map([[`${PROJECTS}/A`, {
    name: 'Alpha', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    workflow: [], snapshots: [], owner: UID, members: { [UID]: 'owner' },
  }]]);
  landInstantly = false;
  rejectCreates = false;
  rejectOrderAppend = false;
  pendingCreates = [];
  writes = [];
  localStorage.setItem('spertcfd-active-project', 'A');
  driver = createFirestoreDriver(UID, {} as Parameters<typeof createFirestoreDriver>[1]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('cloud mode: a project you just created can be opened (QC26 Q01)', () => {
  it('control: when the create lands before any read, Open shows the new project', async () => {
    landInstantly = true;
    const { result, create } = await mountWithProjectA();
    const { id } = create();
    await settle();
    act(() => { result.current.list.switchProject(id); });
    await settle();
    expect(result.current.active.project?.id).toBe(id);
  });

  it('opens the new project once its write has landed', async () => {
    const { result, create } = await mountWithProjectA();
    const { id } = create();
    await settle();          // the reads the create triggered come back
    act(() => { land(); });  // the server acknowledges the write
    await settle();
    act(() => { result.current.list.switchProject(id); }); // the card's Open button
    await settle();
    expect(result.current.active.project?.id).toBe(id);
    expect(result.current.active.project?.name).toBe('Beta');
  });

  it('opens the new project when Open is clicked before the write lands', async () => {
    const { result, create } = await mountWithProjectA();
    const { id } = create();
    act(() => { result.current.list.switchProject(id); });
    await settle();
    act(() => { land(); });
    await settle();
    expect(result.current.active.project?.id).toBe(id);
  });

  it('never holds another project under the new id, and an edit then writes the active project', async () => {
    const { result, create } = await mountWithProjectA();
    create();
    // Inside the round trip: local work (promise callbacks, renders) has run,
    // but no timer has, so the server has not answered any read. The instant
    // before even local work runs is not tested here: there ANY switch still
    // shows the previous project (QC26 candidate C-2, out of scope).
    await act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); });
    const { list, active } = result.current;
    if (active.project) expect.soft(active.project.id).toBe(list.activeProjectId);
    writes = [];
    act(() => { result.current.active.updateWorkflow([]); });
    await settle(15); // past the 200 ms save debounce
    const saves = writes.filter((w) => w.merge).map((w) => w.path);
    for (const path of saves) expect.soft(path).toBe(`${PROJECTS}/${result.current.list.activeProjectId}`);
  });

  it('a create the server rejects removes its card and restores the previous project', async () => {
    rejectCreates = true;
    const { result, create } = await mountWithProjectA();
    const { id, outcome } = create();
    await settle();
    act(() => { land(); });
    await settle();
    expect.soft(result.current.list.projects.map((p) => p.id)).not.toContain(id);
    expect.soft(result.current.list.activeProjectId).toBe('A');
    expect.soft(result.current.active.project?.id).toBe('A');
    expect.soft(await outcome).toBe('rejected:permission-denied'); // so the Projects tab can say so
  });

  it('a rejection that arrives after the user opened another project leaves that project open', async () => {
    // RQ3 from the PR review (Rev-Q01): pins the "only if still active" guard.
    rejectCreates = true;
    server.set(`${PROJECTS}/B`, {
      name: 'Bravo', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      workflow: [], snapshots: [], owner: UID, members: { [UID]: 'owner' },
    });
    const { result, create } = await mountWithProjectA();
    const { id } = create('Beta');
    act(() => { result.current.list.switchProject('B'); });
    await settle();
    act(() => { land(); });
    await settle();
    expect.soft(result.current.list.projects.map((p) => p.id)).not.toContain(id);
    expect.soft(result.current.list.activeProjectId).toBe('B');
    expect.soft(result.current.active.project?.id).toBe('B');
  });

  it('a project that saved but missed the saved order keeps its card and stays open', async () => {
    // The project write landed; only the projectOrder append was refused
    // (e.g. a settings field the rules do not yet allow). The project exists,
    // so it must not be reported as unsaved or removed (Rev-Q01 F2).
    rejectOrderAppend = true;
    const { result, create } = await mountWithProjectA();
    const { id, outcome } = create();
    await settle();
    act(() => { land(); });
    await settle();
    expect.soft(await outcome).toBe('resolved');
    expect.soft(result.current.list.projects.map((p) => p.id)).toContain(id);
    expect.soft(result.current.list.activeProjectId).toBe(id);
    expect.soft(result.current.active.project?.id).toBe(id);
  });
});

describe('a create that fails in either storage mode', () => {
  it('a driver that throws synchronously (local storage full) is handled like a rejected create', async () => {
    // The local driver writes synchronously, and storage.ts saveProject does
    // not guard localStorage.setItem, so a full store throws out of the call.
    const quotaExceeded = Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
    driver = { ...driver, createProject: () => { throw quotaExceeded; } };
    const { result, create } = await mountWithProjectA();
    const { outcome } = create();
    await settle();
    expect.soft(await outcome).toBe('rejected:QuotaExceededError');
    expect.soft(result.current.list.projects.map((p) => p.name)).not.toContain('Beta');
    expect.soft(result.current.list.activeProjectId).toBe('A');
    expect.soft(result.current.active.project?.id).toBe('A');
  });
});
