// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom
//
// v0.19.0 (DASH26 R25, O24): an edit whose local save is refused because the
// browser's storage is full. The local driver writes localStorage
// synchronously and the save is called inside a setProject updater: until
// v0.19.0 the throw escaped the updater, React took it for a render error and
// the app's outermost boundary replaced the whole app, the edit lost
// (measured in Chrome, Opus-R1b-2 -01; again in this release's before-run).
// Now: no boundary error, the edit stays in the copy, and `storageFull` says
// so until Dismiss or the next save that succeeds.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React, { Component, type ReactNode } from 'react';
import type { Project, WorkflowState } from '@/types';

const project: Project = {
  id: 'p1',
  name: 'Full',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  workflow: [{ id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 }],
  snapshots: [],
  settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
};

const h = vi.hoisted(() => ({ saveProject: vi.fn() }));
const driver = {
  mode: 'local' as const,
  workspaceId: 'ws',
  flush: vi.fn(),
  loadProject: vi.fn(async () => project),
  saveProject: h.saveProject,
  onProjectChange: vi.fn(() => () => {}),
};
vi.mock('@/contexts/project-list-context', () => ({
  useProjectList: () => ({ activeProjectId: 'p1', projectUpdateKey: 0, projects: [], importedActiveProject: null }),
}));
vi.mock('@/contexts/storage-context', () => ({ useStorage: () => ({ driver, mode: 'local' }) }));

import { ActiveProjectProvider, useActiveProject } from '../active-project-context';

const caught: unknown[] = [];
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { caught.push(err); }
  render() { return this.state.failed ? null : this.props.children; }
}
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Boundary><ActiveProjectProvider>{children}</ActiveProjectProvider></Boundary>
);

/** jsdom's own quota error is a DOMException of jsdom's realm; Chrome's is QuotaExceededError, code 22. */
const quota = () => new DOMException('The quota has been exceeded.', 'QuotaExceededError');
const throwFull = () => { throw quota(); };

async function mount() {
  const r = renderHook(() => useActiveProject(), { wrapper });
  await act(async () => { await new Promise((res) => setTimeout(res, 0)); });
  expect(r.result.current.project?.id).toBe('p1'); // fixture sanity
  return r;
}
const settle = () => act(async () => { await new Promise((res) => setTimeout(res, 0)); });
const EDITED: WorkflowState[] = [{ id: 'x', name: 'Edited', color: '#000000', category: 'active', order: 0 }];

beforeEach(() => {
  caught.length = 0;
  h.saveProject.mockReset().mockImplementation(throwFull);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe.each([
  ['updateWorkflow', (c: ReturnType<typeof useActiveProject>) => c.updateWorkflow(EDITED), (c: ReturnType<typeof useActiveProject>) => c.workflow[0]?.name === 'Edited'],
  ['updateSnapshots', (c: ReturnType<typeof useActiveProject>) => c.updateSnapshots([{ date: '2026-06-19', counts: { backlog: 4 } }]), (c: ReturnType<typeof useActiveProject>) => c.snapshots.length === 1],
  ['updateSettings', (c: ReturnType<typeof useActiveProject>) => c.updateSettings({ showWipWarnings: false }), (c: ReturnType<typeof useActiveProject>) => c.settings.showWipWarnings === false],
] as const)('%s with storage full (P6)', (_name, edit, edited) => {
  it('keeps the app up and the edit on screen, and says storage is full', async () => {
    const { result } = await mount();
    expect(result.current.storageFull).toBe(false);
    act(() => { edit(result.current); });
    await settle();
    expect(caught).toEqual([]);
    expect(result.current.project).not.toBeNull();
    expect(edited(result.current)).toBe(true);
    expect(result.current.storageFull).toBe(true);
  });
});

describe('the storage-full flag\'s life (F4)', () => {
  it('Dismiss clears it', async () => {
    const { result } = await mount();
    act(() => { result.current.updateWorkflow(EDITED); });
    await settle();
    expect(result.current.storageFull).toBe(true);
    act(() => { result.current.dismissStorageFull(); });
    expect(result.current.storageFull).toBe(false);
  });

  it('the next save that succeeds clears it, and that save carries the earlier edit', async () => {
    const { result } = await mount();
    act(() => { result.current.updateWorkflow(EDITED); });
    await settle();
    h.saveProject.mockReset().mockResolvedValue(undefined);
    act(() => { result.current.updateSettings({ showWipWarnings: false }); });
    await settle();
    expect(result.current.storageFull).toBe(false);
    const saved = h.saveProject.mock.calls.at(-1)![0] as Project;
    expect(saved.workflow[0].name).toBe('Edited');
    expect(saved.settings.showWipWarnings).toBe(false);
  });

  it('a refusal that is not storage full is only logged (no flag), as before', async () => {
    h.saveProject.mockReset().mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    const { result } = await mount();
    act(() => { result.current.updateWorkflow(EDITED); });
    await settle();
    expect(result.current.storageFull).toBe(false);
    expect(caught).toEqual([]);
  });

  it('Firefox\'s name (NS_ERROR_DOM_QUOTA_REACHED) counts too', async () => {
    h.saveProject.mockReset().mockImplementation(() => { throw new DOMException('full', 'NS_ERROR_DOM_QUOTA_REACHED'); });
    const { result } = await mount();
    act(() => { result.current.updateWorkflow(EDITED); });
    await settle();
    expect(result.current.storageFull).toBe(true);
  });
});
