// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// N13 (FRAME26, v0.22.0; Orch-FRAME-2's D6): the storage gate shows its `fallback` while the driver is not ready
// (cloud chosen, auth still resolving), rendered inside the provider so it can read `mode`; with no fallback it shows
// its own bare "Loading..." as before; and once ready it shows the children, never the fallback. AppShell passes the
// frame, so no frameless loading screen remains (contract §7, "Loading").

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ authLoading: true }));
vi.mock('@/lib/sign-out-cleanup-registry', () => ({ registerSignOutCleanup: vi.fn(() => () => {}), runSignOutCleanup: vi.fn() }));
vi.mock('@/lib/app-data-reset-registry', () => ({ registerDataReset: vi.fn(() => () => {}), runDataReset: vi.fn() }));
vi.mock('@/lib/local-storage-driver', () => ({ createLocalStorageDriver: vi.fn(() => ({ mode: 'local', cancelPendingSaves: vi.fn(), flush: vi.fn() })) }));
vi.mock('@/lib/firestore-driver', () => ({ createFirestoreDriver: vi.fn(() => ({ mode: 'cloud', cancelPendingSaves: vi.fn(), flush: vi.fn() })) }));
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null }, db: {}, isFirebaseConfigured: true, googleProvider: null, microsoftProvider: null }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: null, isAuthLoading: h.authLoading }) }));

import { StorageProvider, useStorage } from '../storage-context';
import { LS_STORAGE_MODE } from '@/lib/constants';

function ModeProbe() {
  return <p data-testid="fallback-mode">{useStorage().mode}</p>;
}

beforeEach(() => {
  localStorage.clear();
  h.authLoading = true;
});

describe('the storage gate\'s fallback', () => {
  it('shows the fallback while cloud is chosen and auth resolves, inside the provider (it reads mode)', () => {
    localStorage.setItem(LS_STORAGE_MODE, 'cloud');
    render(<StorageProvider fallback={<ModeProbe />}><p>children</p></StorageProvider>);
    expect(screen.getByTestId('fallback-mode').textContent).toBe('local');
    expect(screen.queryByText('children')).toBeNull();
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  it('without a fallback, shows its own "Loading..." as before', () => {
    localStorage.setItem(LS_STORAGE_MODE, 'cloud');
    render(<StorageProvider><p>children</p></StorageProvider>);
    expect(screen.getByText('Loading...')).toBeTruthy();
    expect(screen.queryByText('children')).toBeNull();
  });

  it('once the driver is ready, shows the children and never the fallback', () => {
    h.authLoading = false;
    render(<StorageProvider fallback={<ModeProbe />}><p>children</p></StorageProvider>);
    expect(screen.getByText('children')).toBeTruthy();
    expect(screen.queryByTestId('fallback-mode')).toBeNull();
  });
});
