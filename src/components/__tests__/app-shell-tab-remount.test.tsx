// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.17.0: the tab's error boundary is keyed by project only on the CFD tab.
// v0.16.4 keyed it by the active project on every tab, so creating a project
// (which makes it active at once) remounted the whole Projects tab: its
// "Couldn't create" alert was lost, and focus could not return to New
// Project. The CFD tab shows one project, so it is still tried afresh when
// the project changes.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';

const h = vi.hoisted(() => ({
  activeProjectId: 'p1',
  mounts: { projects: 0, cfd: 0 },
}));
const { passThrough } = vi.hoisted(() => ({
  passThrough: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/contexts/auth-context', () => ({
  AuthProvider: passThrough,
  useAuth: () => ({
    user: null,
    signOut: vi.fn(),
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
    switchMode: vi.fn(),
    isCloudAvailable: true,
    driver: { mode: 'cloud', loadProject: async () => null },
  }),
}));
vi.mock('@/contexts/project-list-context', () => ({
  ProjectListProvider: passThrough,
  useProjectList: () => ({ isLoaded: true, projects: [], activeProjectId: h.activeProjectId, switchProject: vi.fn() }),
}));
vi.mock('@/contexts/active-project-context', () => ({ ActiveProjectProvider: passThrough }));
vi.mock('../invitation-banner', () => ({ InvitationBanner: () => null }));
vi.mock('../cloud-storage-modal', () => ({ CloudStorageModal: () => null }));
vi.mock('../projects-tab', () => ({
  ProjectsTab: () => {
    useEffect(() => { h.mounts.projects++; }, []);
    return <p>Projects tab</p>;
  },
}));
vi.mock('../project-dashboard', () => ({
  ProjectDashboard: () => {
    useEffect(() => { h.mounts.cfd++; }, []);
    return <p>CFD tab</p>;
  },
}));

import { AppShell } from '../app-shell';

beforeEach(() => {
  h.activeProjectId = 'p1';
  h.mounts = { projects: 0, cfd: 0 };
});

describe('AppShell: a change of active project', () => {
  it('keeps the Projects tab mounted (a create makes the new project active at once)', () => {
    const { rerender } = render(<AppShell />);
    expect(screen.getByText('Projects tab')).toBeTruthy();
    expect(h.mounts.projects).toBe(1);
    h.activeProjectId = 'p2';
    rerender(<AppShell />);
    expect(h.mounts.projects).toBe(1);
  });

  it('still mounts the CFD tab afresh for the new project', () => {
    const { rerender } = render(<AppShell />);
    fireEvent.click(screen.getByRole('button', { name: 'CFD' }));
    expect(h.mounts.cfd).toBe(1);
    h.activeProjectId = 'p2';
    rerender(<AppShell />);
    expect(h.mounts.cfd).toBe(2);
  });
});
