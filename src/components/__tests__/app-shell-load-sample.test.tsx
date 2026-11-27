// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.23.0 (FRAME26 clean-up L, contract §7): a saved sample is opened on the
// CFD tab as a tile opens a project, and announced in a polite live region
// that lives in the shell, outside the tabs (the Projects tab unmounts as the
// CFD tab opens). A second load is announced again.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({ switchProject: vi.fn() }));
const { passThrough } = vi.hoisted(() => ({
  passThrough: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/contexts/auth-context', () => ({
  AuthProvider: passThrough,
  useAuth: () => ({ user: null, signOut: vi.fn(), signInWithGoogle: vi.fn(), signInWithMicrosoft: vi.fn(), signInError: null, clearSignInError: vi.fn() }),
}));
vi.mock('@/contexts/storage-context', () => ({
  StorageProvider: passThrough,
  useStorage: () => ({ mode: 'local', switchMode: vi.fn(), isCloudAvailable: false, driver: { mode: 'local', loadProject: async () => null } }),
}));
vi.mock('@/contexts/project-list-context', () => ({
  ProjectListProvider: passThrough,
  useProjectList: () => ({ isLoaded: true, projects: [], activeProjectId: null, switchProject: h.switchProject }),
}));
vi.mock('@/contexts/active-project-context', () => ({ ActiveProjectProvider: passThrough, useActiveProject: () => ({ project: null }) }));
vi.mock('../invitation-banner', () => ({ InvitationBanner: () => null }));
vi.mock('../cloud-storage-modal', () => ({ CloudStorageModal: () => null }));
// The Projects tab: its Load Sample resolves, then hands the saved sample to the shell.
vi.mock('../projects-tab', () => ({
  ProjectsTab: ({ onOpenSample }: { onOpenSample: (s: { id: string; name: string }) => void }) => (
    <>
      <button type="button" onClick={() => onOpenSample({ id: 's1', name: 'Sample: 2-Week Sprint' })}>Load first</button>
      <button type="button" onClick={() => onOpenSample({ id: 's2', name: 'Sample: 2-Week Sprint (2)' })}>Load second</button>
    </>
  ),
}));
vi.mock('../project-dashboard', () => ({ ProjectDashboard: () => <p>CFD tab</p> }));

import { AppShell } from '../app-shell';

const live = () => document.querySelector('[data-sample-status]') as HTMLElement;
const current = () => document.querySelector('[data-sf="nav"] [aria-current="page"]')?.textContent;

beforeEach(() => { vi.useFakeTimers(); h.switchProject.mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe('Load Sample in the shell', () => {
  it('the region is polite, visually hidden, mounted and empty before any load', () => {
    render(<AppShell />);
    expect(live().getAttribute('aria-live')).toBe('polite');
    expect(live().getAttribute('aria-atomic')).toBe('true');
    expect(live().className).toBe('sr-only');
    expect(live().getAttribute('role')).toBeNull();
    expect(live().textContent).toBe('');
  });

  it('opens the sample on the CFD tab and announces it in the contract\'s words', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByRole('button', { name: 'Load first' }));
    expect(h.switchProject).toHaveBeenCalledWith('s1');
    expect(current()).toBe('CFD');
    expect(screen.getByText('CFD tab')).toBeTruthy();
    // Emptied first, filled after a macrotask.
    expect(live().textContent).toBe('');
    act(() => { vi.runAllTimers(); });
    expect(live().textContent).toBe('Added “Sample: 2-Week Sprint” to your projects and opened it.');
  });

  it('a second load is announced again, with its number', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByRole('button', { name: 'Load first' }));
    act(() => { vi.runAllTimers(); });
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load second' }));
    expect(live().textContent).toBe('');
    act(() => { vi.runAllTimers(); });
    expect(live().textContent).toBe('Added “Sample: 2-Week Sprint (2)” to your projects and opened it.');
    expect(h.switchProject).toHaveBeenLastCalledWith('s2');
  });
});
