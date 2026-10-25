// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom
//
// QC26 Q02 — signing out of cloud mode must not delete the local projects the
// user kept. Flow level: the real AuthProvider, StorageProvider,
// ProjectListProvider and StorageSection (the Settings UI: the mode radios,
// Upload / Skip, Keep Local Copy, Sign out), both real drivers, the real
// sign-out and data-reset registries and the real storage.ts over jsdom's
// localStorage. Only the Firebase SDK seam is mocked, plus the two
// fire-and-forget network calls a sign-in makes.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import React from 'react';

const ALICE = 'uid-alice';
const BOB = 'uid-bob';
const PROJECTS = 'spertcfd_projects';
const OLD_TOS = '01-01-2026';

type Data = Record<string, unknown>;
type Ref = { path: string; id: string; col: string };
type AuthListener = (u: unknown) => Promise<void> | void;

// ── firebase/auth: one listener; signOut notifies it, as the SDK does ─────────
let authListener: AuthListener | null = null;
let authSettled: Promise<unknown> = Promise.resolve();
let signOutCalls = 0;

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: AuthListener) => {
    authListener = cb;
    return () => {
      if (authListener === cb) authListener = null;
    };
  },
  signOut: async () => {
    signOutCalls++;
    // The SDK clears the user, then notifies listeners asynchronously.
    authSettled = Promise.resolve().then(() => authListener?.(null));
  },
  signInWithPopup: async () => {},
}));

// ── firebase/firestore: a small server ────────────────────────────────────────
let server: Map<string, Data>;
let firestoreTos: string | null; // users/{uid}.tosVersion; null = no record
let projectWrites: string[];
let listReads: number;

const denied = () =>
  Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
const snapOf = (ref: Ref, data: Data | undefined) => ({
  id: ref.id,
  exists: () => data !== undefined,
  data: () => data,
  metadata: { hasPendingWrites: false },
});

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string): Ref => ({ path: `${col}/${id}`, id, col }),
  collection: (_db: unknown, col: string) => ({ col }),
  where: (field: string) => ({ field }),
  query: (c: { col: string }, w: { field: string }) => ({
    _query: true,
    col: c.col,
    uid: w.field.split('.')[1],
  }),
  arrayUnion: (...v: unknown[]) => ({ _arrayUnion: v }),
  arrayRemove: (...v: unknown[]) => ({ _arrayRemove: v }),
  deleteField: () => ({ _deleteField: true }),
  serverTimestamp: () => ({ _serverTimestamp: true }),
  runTransaction: async () => {},
  deleteDoc: async () => {},
  getDoc: async (ref: Ref) => {
    if (ref.col === 'users') {
      return snapOf(ref, firestoreTos === null ? undefined : { tosVersion: firestoreTos });
    }
    const data = server.get(ref.path);
    // A project doc the server does not hold is denied (resource null).
    if (data === undefined && ref.col === PROJECTS) throw denied();
    return snapOf(ref, data);
  },
  getDocFromCache: async () => {
    throw Object.assign(new Error('Failed to get document from cache.'), { code: 'unavailable' });
  },
  getDocs: async (q: { uid: string }) => {
    listReads++;
    const docs = [...server.entries()]
      .filter(([path, d]) => path.startsWith(PROJECTS + '/') && (d.members as Data)?.[q.uid])
      .map(([path, d]) => ({ id: path.split('/')[1], data: () => d }));
    return { forEach: (cb: (d: unknown) => void) => docs.forEach(cb) };
  },
  setDoc: async (ref: Ref, data: Data, opts?: unknown) => {
    if (ref.col !== PROJECTS) return;
    projectWrites.push(ref.path);
    server.set(ref.path, opts === undefined ? data : { ...server.get(ref.path), ...data });
  },
  onSnapshot: () => () => {},
}));

vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  isFirebaseConfigured: true,
  googleProvider: {},
  microsoftProvider: {},
  functions: null,
}));
vi.mock('@/lib/callables', () => ({
  callClaimPendingInvitations: async () => ({ claimed: [] }),
  callSendInvitationEmail: async () => ({}),
  callRevokeInvite: async () => ({}),
  callResendInvite: async () => ({}),
}));
vi.mock('@/lib/profile-writes', () => ({ writeUserProfile: () => {} }));

// ── Import after mocks ────────────────────────────────────────────────────────
import { AuthProvider } from '../auth-context';
import { StorageProvider, useStorage } from '../storage-context';
import { ProjectListProvider, useProjectList } from '../project-list-context';
import { StorageSection } from '@/components/storage-section';
import { createLocalStorageDriver } from '@/lib/local-storage-driver';
import {
  LS_ACTIVE_PROJECT,
  LS_HAS_UPLOADED,
  LS_STORAGE_MODE,
  LS_TOS_ACCEPTED_VERSION,
  TOS_VERSION,
} from '@/lib/constants';
import { SESSION_KEY } from '@/lib/invite-capture';
import { hasAcceptedCurrentTos } from '@/lib/consent';
import type { Project } from '@/types';

// ── The tree ──────────────────────────────────────────────────────────────────
function Probe() {
  const { mode } = useStorage();
  const { projects, createProject, renameProject, switchProject } = useProjectList();
  const rename = (from: string, to: string) => {
    const hit = projects.find((p) => p.name === from);
    if (hit) renameProject(hit.id, to);
  };
  return (
    <div>
      <output data-testid="mode">{mode}</output>
      <ul data-testid="projects">
        {projects.map((p) => <li key={p.id}>{p.name}</li>)}
      </ul>
      <button onClick={() => { void createProject('Made while local'); }}>probe-create</button>
      <button onClick={() => rename('Team board', 'Team board, edited while local')}>probe-rename</button>
      <button onClick={() => rename('Made while local', 'Made while local, renamed')}>probe-rename-made</button>
      <button onClick={() => { if (projects[0]) switchProject(projects[0].id); }}>probe-switch-first</button>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <StorageProvider>
        <ProjectListProvider>
          <StorageSection />
          <Probe />
        </ProjectListProvider>
      </StorageProvider>
    </AuthProvider>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const userOf = (uid: string) => ({
  uid,
  email: `${uid}@example.com`,
  displayName: uid,
  emailVerified: true,
  providerData: [{ providerId: 'google.com' }],
});

/** Lets effects, driver swaps and the async list loads run to rest. */
async function settle() {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

async function click(name: string | RegExp, role: 'button' | 'radio' = 'button') {
  await act(async () => {
    fireEvent.click(screen.getByRole(role, { name }));
  });
  await settle();
}

async function mount() {
  render(<App />);
  await settle();
}

/** Firebase resolves auth on load: a user, or null for "signed out". */
async function authResolves(user: ReturnType<typeof userOf> | null) {
  await act(async () => {
    await authListener!(user);
  });
  await settle();
}

/** Path 1: the user's own Sign out button. */
async function signOutViaButton() {
  await click('Sign out');
  await act(async () => {
    await authSettled;
  });
  await settle();
}

/** Path 3: onAuthStateChanged(null) from outside — another tab, a revoked token. */
async function signedOutElsewhere() {
  await authResolves(null);
}

const shownNames = () =>
  within(screen.getByTestId('projects')).queryAllByRole('listitem').map((li) => li.textContent);
const storedLocalNames = async () =>
  (await createLocalStorageDriver().loadProjectList()).map((p) => p.name);
const mode = () => screen.getByTestId('mode').textContent;

function dumpStorage(): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    out[k] = localStorage.getItem(k);
  }
  return out;
}

function cloudProject(id: string, name: string, owner: string): Data {
  return {
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    workflow: [{ id: 'b', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 }],
    snapshots: [{ date: '2026-01-02', counts: { b: 3 } }],
    settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
    owner,
    members: { [owner]: 'owner' },
    _originRef: owner,
    id,
  };
}

function localProject(id: string, name: string): Project {
  return {
    id,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    workflow: [{ id: 'b', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 }],
    snapshots: [{ date: '2026-01-02', counts: { b: 3 } }],
    settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
  };
}

/** A user who made a project in local mode, then signed in (still local). */
async function localUserSignsIn() {
  await mount();
  await authResolves(null);
  await click('probe-create');
  expect(shownNames()).toContain('Made while local');
  await authResolves(userOf(ALICE));
  expect(mode()).toBe('local');
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(LS_TOS_ACCEPTED_VERSION, TOS_VERSION);
  server = new Map();
  firestoreTos = TOS_VERSION;
  projectWrites = [];
  listReads = 0;
  signOutCalls = 0;
  authListener = null;
  authSettled = Promise.resolve();
});

// ── The user's invariant: one case per route in, and per sign-out path ───────
describe('a project created in local mode is still there after signing out of cloud mode', () => {
  it('R1 Skip on the upload prompt, then Sign out (Path 1)', async () => {
    await localUserSignsIn();
    await click(/Cloud Storage/, 'radio');
    expect(screen.getByText(/Upload to cloud\?/)).toBeTruthy();
    await click('Skip');
    expect(mode()).toBe('cloud');
    expect(await storedLocalNames()).toContain('Made while local'); // Skip itself deletes nothing

    await signOutViaButton();

    expect(mode()).toBe('local');
    expect(await storedLocalNames()).toContain('Made while local');
    expect(shownNames()).toContain('Made while local');
  });

  it('R1 Skip, then signed out from outside (Path 3: another tab, a revoked token)', async () => {
    await localUserSignsIn();
    await click(/Cloud Storage/, 'radio');
    await click('Skip');
    expect(mode()).toBe('cloud');

    await signedOutElsewhere();

    expect(mode()).toBe('local');
    expect(await storedLocalNames()).toContain('Made while local');
    expect(shownNames()).toContain('Made while local');
  });

  it('R2 Upload with "Clear local copies after upload" unchecked, then Sign out', async () => {
    await localUserSignsIn();
    await click(/Cloud Storage/, 'radio');
    expect((screen.getByRole('checkbox', { name: /Clear local copies/ }) as HTMLInputElement).checked).toBe(false);
    await click('Upload');
    expect(mode()).toBe('cloud');
    expect(shownNames()).toContain('Made while local'); // the cloud copy

    await signOutViaButton();

    expect(await storedLocalNames()).toContain('Made while local');
    expect(shownNames()).toContain('Made while local');
  });

  it('R3 Keep Local Copy, edit while local, back to cloud (no prompt), then Sign out', async () => {
    localStorage.setItem(LS_STORAGE_MODE, 'cloud');
    localStorage.setItem(LS_HAS_UPLOADED, 'true');
    server.set(`${PROJECTS}/team1`, cloudProject('team1', 'Team board', ALICE));
    await mount();
    await authResolves(userOf(ALICE));
    expect(mode()).toBe('cloud');
    expect(shownNames()).toEqual(['Team board']);

    await click(/Local Storage/, 'radio');
    await click('Keep Local Copy');
    expect(mode()).toBe('local');
    await click('probe-rename');
    await click('probe-create');
    expect(shownNames()).toEqual(['Team board, edited while local', 'Made while local']);

    await click(/Cloud Storage/, 'radio');
    expect(screen.queryByText(/Upload to cloud\?/)).toBeNull(); // fast path: never offered
    expect(mode()).toBe('cloud');

    await signOutViaButton();

    const kept = await storedLocalNames();
    expect(kept).toContain('Team board, edited while local');
    expect(kept).toContain('Made while local');
  });

  it('R4 work done signed out after a cloud sign-out, then sign in (straight to cloud, no prompt), then Sign out', async () => {
    // A previous cloud session's sign-out leaves the stored mode at 'cloud'.
    localStorage.setItem(LS_STORAGE_MODE, 'cloud');
    await mount();
    await authResolves(null);
    expect(mode()).toBe('local');
    await click('probe-create');

    await authResolves(userOf(ALICE));
    expect(mode()).toBe('cloud');
    expect(screen.queryByText(/Upload to cloud\?/)).toBeNull();

    await signOutViaButton();

    expect(await storedLocalNames()).toContain('Made while local');
    expect(shownNames()).toContain('Made while local');
  });
});

// ── Path 2, the ToS-version sign-out at app load ──────────────────────────────
describe('Path 2 — ToS version mismatch at app load', () => {
  function seedReturningUser(storedMode: 'cloud' | null) {
    if (storedMode) localStorage.setItem(LS_STORAGE_MODE, storedMode);
    localStorage.setItem(LS_TOS_ACCEPTED_VERSION, OLD_TOS);
    firestoreTos = OLD_TOS;
    const local = createLocalStorageDriver();
    void local.createProject(localProject('keep1', 'Kept local one'));
    void local.createProject(localProject('keep2', 'Kept local two'));
    localStorage.setItem(LS_HAS_UPLOADED, 'true');
    localStorage.setItem(LS_ACTIVE_PROJECT, 'cloudactive');
  }

  it.each([['cloud' as const], [null]])(
    'stored mode %s: signs the user out and clears nothing',
    async (storedMode) => {
      seedReturningUser(storedMode);
      await mount();
      await authResolves(userOf(ALICE));
      await act(async () => {
        await authSettled;
      });
      await settle();

      // Controls: Path 2 really ran.
      expect(signOutCalls).toBe(1);
      expect(localStorage.getItem(LS_TOS_ACCEPTED_VERSION)).toBeNull();
      expect(listReads).toBe(0); // no cloud driver was ever created

      // Nothing cleared.
      expect(localStorage.getItem('cfd-lab-project-keep1')).not.toBeNull();
      expect(localStorage.getItem('cfd-lab-project-keep2')).not.toBeNull();
      expect(localStorage.getItem(LS_HAS_UPLOADED)).toBe('true');
      expect(localStorage.getItem(LS_ACTIVE_PROJECT)).toBe('cloudactive');
      expect(mode()).toBe('local');
      expect(shownNames()).toEqual(['Kept local one', 'Kept local two']);
    },
  );

  describe('the October 26, 2026 editions', () => {
    async function returningUserLoads(accepted: string) {
      localStorage.setItem(LS_TOS_ACCEPTED_VERSION, accepted);
      firestoreTos = accepted;
      await mount();
      await authResolves(userOf(ALICE));
      await act(async () => {
        await authSettled;
      });
      await settle();
    }

    it('signs out a returning user who accepted the October 5, 2026 editions, so they are asked again', async () => {
      await returningUserLoads('10-05-2026');

      expect(signOutCalls).toBe(1);
      expect(localStorage.getItem(LS_TOS_ACCEPTED_VERSION)).toBeNull();
    });

    it('keeps a returning user who accepted the October 26, 2026 editions signed in', async () => {
      await returningUserLoads('10-26-2026');

      expect(signOutCalls).toBe(0);
      expect(localStorage.getItem(LS_TOS_ACCEPTED_VERSION)).toBe('10-26-2026');
    });
  });
});

// ── What a cloud session writes to this browser ───────────────────────────────
// If the census fails, a cloud session now leaves another key in the browser:
// decide whether clearCloudSessionKeys must remove it at sign-out.
describe('keys written to this browser while the driver is cloud', () => {
  it.each([
    ['Path 1', signOutViaButton],
    ['Path 3', signedOutElsewhere],
  ])('a cloud session writes only the active-project pointer, and %s clears it and the upload flag', async (_path, signOut) => {
    await localUserSignsIn();
    await click(/Cloud Storage/, 'radio');
    await click('Skip');
    expect(mode()).toBe('cloud');
    expect(localStorage.getItem(LS_HAS_UPLOADED)).toBe('true');

    // A before/after diff of the whole store: jsdom's localStorage does not
    // route through a spy on Storage.prototype (measured: it saw no writes).
    const before = dumpStorage();
    await click('probe-create'); // a cloud create; becomes the active project
    await click('probe-rename-made'); // a cloud save
    await click('probe-switch-first');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300)); // let the debounced save land
    });
    expect(projectWrites.length).toBeGreaterThanOrEqual(2); // control: the session did write, to the cloud
    const after = dumpStorage();
    const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter((k) => before[k] !== after[k])
      .sort();
    expect(changed).toEqual([LS_ACTIVE_PROJECT]);
    const cloudActive = localStorage.getItem(LS_ACTIVE_PROJECT);
    expect(server.has(`${PROJECTS}/${cloudActive}`)).toBe(true); // it points at a cloud doc

    await signOut();

    expect(localStorage.getItem(LS_ACTIVE_PROJECT)).toBeNull();
    expect(localStorage.getItem(LS_HAS_UPLOADED)).toBeNull();
    expect(await storedLocalNames()).toContain('Made while local');
  });
});

// ── The next person at this browser ───────────────────────────────────────────
describe('the next person to sign in after a cloud sign-out', () => {
  it('lands in cloud mode at once and is not shown the upload prompt', async () => {
    await localUserSignsIn();
    await click(/Cloud Storage/, 'radio');
    await click('Skip');
    await signOutViaButton();

    await authResolves(userOf(BOB));

    expect(localStorage.getItem(LS_STORAGE_MODE)).toBe('cloud');
    expect(mode()).toBe('cloud');
    expect(screen.queryByText(/Upload to cloud\?/)).toBeNull();
  });
});

// ── A pending invite token must not outlive a user-initiated sign-out ─────────
// Otherwise the next person on this tab sees a stray "you've been added" banner.
describe('a pending invite token is cleared on sign-out (B-12)', () => {
  it('Path 1 (the Sign out button) removes it from sessionStorage', async () => {
    await localUserSignsIn();
    sessionStorage.setItem(SESSION_KEY, 'tok-stale');
    // Control: it is present before sign-out (the invitation-landing flow did
    // not consume it — e.g. the user signed out from the banner's pre-auth state).
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('tok-stale');

    await signOutViaButton();

    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

// ── The Terms-acceptance flag must not outlive a user-initiated sign-out ──────
// LS_TOS_ACCEPTED_VERSION is a per-browser value the sign-in gate
// (handleSignInRequest → hasAcceptedCurrentTos) trusts. Kept across sign-out,
// it let the next person on a shared computer skip the Terms and have a
// users/{uid} acceptance record written for them. A user-initiated sign-out
// must reset it so the next person is re-prompted.
describe('Terms acceptance is reset on sign-out (B-10)', () => {
  it('Path 1 (the Sign out button) clears LS_TOS_ACCEPTED_VERSION', async () => {
    await localUserSignsIn();
    // Control: the signed-in user's acceptance is present before sign-out.
    expect(localStorage.getItem(LS_TOS_ACCEPTED_VERSION)).toBe(TOS_VERSION);
    expect(hasAcceptedCurrentTos()).toBe(true);

    await signOutViaButton();

    expect(localStorage.getItem(LS_TOS_ACCEPTED_VERSION)).toBeNull();
    // The sign-in gate now re-prompts the next person for the Terms.
    expect(hasAcceptedCurrentTos()).toBe(false);
  });
});
