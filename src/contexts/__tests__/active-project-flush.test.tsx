// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// ── Mock driver ───────────────────────────────────────────────────────────────
const mockFlush = vi.fn();
const mockDriver = {
  mode: 'local' as const,
  workspaceId: 'ws-test',
  flush: mockFlush,
  cancelPendingSaves: vi.fn(),
  loadProjectList: vi.fn().mockResolvedValue([]),
  loadProject: vi.fn().mockResolvedValue(null),
  createProject: vi.fn().mockResolvedValue(undefined),
  saveProject: vi.fn().mockResolvedValue(undefined),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  getActiveProjectId: vi.fn(() => null),
  setActiveProjectId: vi.fn(),
  reorderProjects: vi.fn().mockResolvedValue(undefined),
  onProjectChange: vi.fn(() => () => {}),
  onProjectListChange: vi.fn(() => () => {}),
  exportProject: vi.fn(() => '{}'),
  importProject: vi.fn(() => null),
  removeCollaborator: vi.fn().mockResolvedValue(undefined),
  listPendingInvites: vi.fn().mockResolvedValue([]),
  revokeInvite: vi.fn().mockResolvedValue(undefined),
  resendInvite: vi.fn().mockResolvedValue(undefined),
};

// ── Context mocks ─────────────────────────────────────────────────────────────
vi.mock('@/contexts/project-list-context', () => ({
  useProjectList: vi.fn(() => ({ activeProjectId: null, projectUpdateKey: 0 })),
}));
vi.mock('@/contexts/storage-context', () => ({
  useStorage: vi.fn(() => ({ driver: mockDriver, mode: 'local' })),
}));
vi.mock('@/lib/app-data-reset-registry', () => ({
  registerDataReset: vi.fn(() => () => {}),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import { ActiveProjectProvider } from '../active-project-context';

// ── Setup / teardown ──────────────────────────────────────────────────────────
beforeEach(() => { vi.clearAllMocks(); });
// restoreAllMocks is critical here: test 2 calls vi.spyOn(...).mockImplementation(...)
// which replaces addEventListener. Without restore, the no-op implementation persists
// into test 3, causing the pagehide listener to never register and mockFlush to go
// uncalled (B1 fix).
afterEach(() => { vi.restoreAllMocks(); });

const wrapper = ({ children }: { children: React.ReactNode }) =>
  <ActiveProjectProvider>{children}</ActiveProjectProvider>;

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('ActiveProjectProvider — D2 pagehide + beforeunload', () => {
  it('registers BOTH beforeunload and pagehide listeners', async () => {
    const spy = vi.spyOn(window, 'addEventListener');
    await act(async () => {
      renderHook(() => {}, { wrapper });
    });
    const events = spy.mock.calls.map(([ev]) => ev);
    expect(events).toContain('beforeunload');
    expect(events).toContain('pagehide');
  });
  it('registers beforeunload and pagehide with DISTINCT handler references', async () => {
    const registered: { event: string; fn: EventListener }[] = [];
    vi.spyOn(window, 'addEventListener').mockImplementation((ev, fn) => {
      if (ev === 'beforeunload' || ev === 'pagehide') {
        registered.push({ event: ev as string, fn: fn as EventListener });
      }
    });
    await act(async () => {
      renderHook(() => {}, { wrapper });
    });
    const beforeUnload = registered.find(r => r.event === 'beforeunload');
    const pageHide = registered.find(r => r.event === 'pagehide');
    expect(beforeUnload).toBeDefined();
    expect(pageHide).toBeDefined();
    // Distinct fn refs — removeEventListener can unregister each independently
    expect(beforeUnload!.fn).not.toBe(pageHide!.fn);
  });
  it('pagehide fires driver.flush()', async () => {
    // Uses the real window.addEventListener (test 2's spy is restored by afterEach).
    await act(async () => {
      renderHook(() => {}, { wrapper });
    });
    mockFlush.mockClear();
    window.dispatchEvent(new Event('pagehide'));
    expect(mockFlush).toHaveBeenCalledTimes(1);
  });
});
