// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.21.0 (DASH26 R36; PR #115 review, Opus-PR115-1 -05, M24 and M25): both places that offer Keep Local Copy,
// rendered, carry the person's colours and archive for the projects they copy into this browser's key. The
// function itself is pinned in src/lib/__tests__/keep-local-copy.test.ts; these hold its two callers, the
// Cloud Storage window (header chip) and Settings' Storage section, each handing it the cloud driver's map.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import type { Project } from '@/types';
import type { PrefsRead } from '@/lib/project-prefs';

const project = (id: string, name: string): Project => ({
  id,
  name,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  workflow: [{ id: 'bl', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 }],
  snapshots: [],
  settings: { gridSortNewestFirst: false, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
});

const h = vi.hoisted(() => ({
  switchMode: vi.fn(),
  prefs: { status: 'ready', prefs: {} } as PrefsRead,
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: { uid: 'uid-me', displayName: 'Me', email: 'me@example.test' },
    signOut: vi.fn(),
    signInWithGoogle: vi.fn(),
    signInWithMicrosoft: vi.fn(),
    signInError: null,
    clearSignInError: vi.fn(),
  }),
}));
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({
    mode: 'cloud',
    switchMode: h.switchMode,
    isCloudAvailable: true,
    driver: {
      mode: 'cloud',
      loadProject: async (id: string) => project(id, id.toUpperCase()),
      getProjectPrefs: () => h.prefs,
      onProjectChange: () => () => {},
      getPendingInvites: async () => [],
    },
  }),
}));
vi.mock('@/contexts/project-list-context', () => ({
  useProjectList: () => ({ projects: [{ id: 'c1', name: 'C1' }, { id: 'c2', name: 'C2' }] }),
}));
vi.mock('../cloud-migration-flow', () => ({
  CloudMigrationFlow: forwardRef(function CloudMigrationFlow(_props, ref) {
    useImperativeHandle(ref, () => ({ requestCloudSwitch: () => {} }));
    return null;
  }),
}));
vi.mock('@/lib/firebase', () => ({ db: {} }));

import { CloudStorageModal } from '../cloud-storage-modal';
import { StorageSection } from '../storage-section';
import { LS_PROJECT_PREFS } from '@/lib/constants';

const stored = () => JSON.parse(localStorage.getItem(LS_PROJECT_PREFS) ?? 'null');
const index = () => JSON.parse(localStorage.getItem('cfd-lab') ?? '{}').projectIds;

beforeEach(() => {
  localStorage.clear();
  h.switchMode.mockReset();
  h.prefs = { status: 'ready', prefs: { c1: { archived: true, color: 'teal' }, other: { color: 'pink' } } };
});

async function keepLocal(localRadio: HTMLElement) {
  fireEvent.click(localRadio);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Keep Local Copy' }));
    await new Promise((res) => setTimeout(res, 20));
  });
}

describe.each([
  ['the Cloud Storage window', () => render(<CloudStorageModal open onClose={() => {}} />), () => screen.getByLabelText('Local (browser only)')],
  ['Settings\' Storage section', () => render(<StorageSection />), () => screen.getByLabelText('Local Storage')],
])('%s', (_name, mount, localRadio) => {
  it('Keep Local Copy copies the projects and their colours and archive, then switches to local', async () => {
    mount();
    await keepLocal(localRadio());
    expect(index()).toEqual(['c1', 'c2']);
    expect(stored()).toEqual({ c1: { archived: true, color: 'teal' } });
    expect(h.switchMode).toHaveBeenCalledWith('local');
  });

  it('copies no colour or archive when the cloud map was never read', async () => {
    h.prefs = { status: 'failed' };
    mount();
    await keepLocal(localRadio());
    expect(index()).toEqual(['c1', 'c2']);
    expect(stored()).toBeNull();
  });
});
