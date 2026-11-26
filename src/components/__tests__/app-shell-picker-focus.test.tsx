// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.18.0 (DASH26 O14): a tile's Open (and Load Sample, which opens the same
// way) asks the CFD tab's picker to take focus as it mounts: once. A request the
// picker never took, because the CFD tab failed as a whole, is dropped on the
// next tab change, so it cannot pull focus on a later visit (PR #108 review,
// -05 and -07). The picker's own half is in project-dashboard-picker.test.tsx.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';

const h = vi.hoisted(() => ({ takes: [] as boolean[], crashNext: false, isLoaded: true }));
const { passThrough } = vi.hoisted(() => ({
  passThrough: ({ children }: { children: ReactNode }) => children,
}));

// v0.22.0 (FRAME26): AppShell routes back to "/" from another route (the frame is held by the layout), and Next's
// useRouter throws outside the App Router. On "/" it never routes.
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
  useProjectList: () => ({ isLoaded: h.isLoaded, projects: [], activeProjectId: 'p1', switchProject: vi.fn() }),
}));
// v0.22.0 (FRAME26): AppShell's CFD heading row reads the loaded project (none here: "CFD").
vi.mock('@/contexts/active-project-context', () => ({ ActiveProjectProvider: passThrough, useActiveProject: () => ({ project: null }) }));
vi.mock('../invitation-banner', () => ({ InvitationBanner: () => null }));
vi.mock('../cloud-storage-modal', () => ({ CloudStorageModal: () => null }));
vi.mock('../projects-tab', () => ({
  ProjectsTab: ({ onOpenInCfd }: { onOpenInCfd: (id: string) => void }) => (
    <button type="button" onClick={() => onOpenInCfd('p2')}>Open p2</button>
  ),
}));
// The CFD tab: its picker takes the request as it mounts, as ProjectPicker does.
vi.mock('../project-dashboard', () => ({
  ProjectDashboard: ({ takePickerFocus }: { takePickerFocus?: () => boolean }) => {
    if (h.crashNext) throw new Error('the whole tab fails, so no picker mounts');
    useEffect(() => { h.takes.push(takePickerFocus?.() ?? false); }, [takePickerFocus]);
    return <p>CFD tab</p>;
  },
}));

import { AppShell } from '../app-shell';

const tabButton = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  h.takes = [];
  h.crashNext = false;
  h.isLoaded = true;
});

describe('AppShell: focus to the picker after a tile\'s Open (O14)', () => {
  it('an Open asks once; a later visit by the tab button does not', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByRole('button', { name: 'Open p2' }));
    expect(h.takes).toEqual([true]);
    fireEvent.click(tabButton('Projects'));
    fireEvent.click(tabButton('CFD'));
    expect(h.takes).toEqual([true, false]);
  });

  it('the picker clears the request it takes: a remount without a tab change (the list reloading, as after a sign-out) does not ask again', () => {
    const view = render(<AppShell />);
    fireEvent.click(screen.getByRole('button', { name: 'Open p2' }));
    expect(h.takes).toEqual([true]);
    h.isLoaded = false;
    view.rerender(<AppShell />);
    h.isLoaded = true;
    view.rerender(<AppShell />);
    expect(screen.getByText('CFD tab')).toBeTruthy();
    expect(h.takes).toEqual([true, false]);
  });

  it('the CFD tab button alone never asks', () => {
    render(<AppShell />);
    fireEvent.click(tabButton('CFD'));
    expect(h.takes).toEqual([false]);
  });

  it('a request the picker never took (the tab failed) is dropped on the next tab change', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<AppShell />);
    h.crashNext = true;
    fireEvent.click(screen.getByRole('button', { name: 'Open p2' }));
    expect(screen.getByRole('alert').textContent).toContain('This view could not be displayed.');
    expect(h.takes).toEqual([]);
    h.crashNext = false;
    fireEvent.click(tabButton('Settings'));
    fireEvent.click(tabButton('CFD'));
    expect(h.takes).toEqual([false]);
  });
});
