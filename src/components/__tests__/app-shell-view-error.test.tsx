// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.16.4: an error while rendering a tab is caught around the tab, so the
// header stays up and with it the two ways out: sign-out, and the storage
// switch. Before v0.16.4 the only boundary wrapped the whole app, and a
// project the Projects tab could not render replaced everything, header
// included, on every load.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { forwardRef, useImperativeHandle, type ReactNode } from 'react';

const h = vi.hoisted(() => ({
  signOut: vi.fn(),
  switchMode: vi.fn(),
  throwInTab: true,
}));
const { passThrough } = vi.hoisted(() => ({
  passThrough: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/contexts/auth-context', () => ({
  AuthProvider: passThrough,
  useAuth: () => ({
    user: { uid: 'u1', displayName: 'Test User', email: 'test@example.com' },
    signOut: h.signOut,
    signInWithGoogle: vi.fn(),
    signInWithMicrosoft: vi.fn(),
    signInError: null,
    clearSignInError: vi.fn(),
  }),
}));
vi.mock('@/contexts/storage-context', () => ({
  StorageProvider: passThrough,
  useStorage: () => ({
    mode: 'cloud',
    switchMode: h.switchMode,
    isCloudAvailable: true,
    driver: { mode: 'cloud', loadProject: async () => null },
  }),
}));
vi.mock('@/contexts/project-list-context', () => ({
  ProjectListProvider: passThrough,
  useProjectList: () => ({ isLoaded: true, projects: [], activeProjectId: 'p1', switchProject: vi.fn() }),
}));
vi.mock('@/contexts/active-project-context', () => ({ ActiveProjectProvider: passThrough }));
vi.mock('../invitation-banner', () => ({ InvitationBanner: () => null }));
vi.mock('../cloud-migration-flow', () => ({
  CloudMigrationFlow: forwardRef(function CloudMigrationFlow(_props, ref) {
    useImperativeHandle(ref, () => ({ requestCloudSwitch: () => {} }));
    return null;
  }),
}));
vi.mock('../projects-tab', () => ({
  ProjectsTab: () => {
    if (h.throwInTab) throw new Error('a value the tab cannot render');
    return <p>Projects</p>;
  },
}));

import { AppShell } from '../app-shell';

describe('AppShell: an error in a tab', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    h.throwInTab = true;
    h.signOut.mockReset().mockResolvedValue(undefined);
    h.switchMode.mockReset();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('is shown in place of the tab, not in place of the app', () => {
    render(<AppShell />);
    expect(screen.getByRole('alert').textContent).toContain('This view could not be displayed.');
    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(screen.getByRole('button', { name: 'Projects' })).toBeTruthy();
  });

  it('leaves sign-out working', async () => {
    render(<AppShell />);
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    });
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });

  it('leaves the switch to local storage working', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Local (browser only)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(h.switchMode).toHaveBeenCalledWith('local');
  });

  it('lets the user move to another tab', () => {
    render(<AppShell />);
    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
