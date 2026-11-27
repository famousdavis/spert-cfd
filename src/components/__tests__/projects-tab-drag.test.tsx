// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.20.2 (DASH26 R2o; PR #114 review -02): the Projects tab's drag handler,
// the only caller of `moveProject`. dnd-kit's own pointer handling is not run
// here (the browser check is in the PR); the `onDragEnd` the tab hands its
// `DndContext` is captured and called as dnd-kit calls it, `{ active, over }`.
import { it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import type { ProjectListItem } from '@/lib/storage-driver';

const h = vi.hoisted(() => ({
  prefsReady: { status: 'ready' as const, prefs: {} as Record<string, { archived?: true }> },
  onDragEnd: null as ((e: DragEndEvent) => void) | null,
  list: {
    projects: [] as ProjectListItem[],
    activeProjectId: null as string | null,
    driverLoading: false,
    createProject: vi.fn(),
    loadSampleProject: vi.fn(),
    cloneProject: vi.fn(),
    deleteProject: vi.fn(),
    renameProject: vi.fn(),
    moveProject: vi.fn(),
  },
  storage: { driver: { mode: 'local' as const, loadProject: vi.fn(async () => null), exportProject: vi.fn(), getProjectPrefs: () => h.prefsReady, onProjectPrefsChange: () => () => {}, setProjectPref: () => null, onProjectPrefsRefused: () => () => {}, retryProjectPrefs: () => {} } },
}));

vi.mock('@dnd-kit/core', async (original) => ({
  ...(await original<typeof import('@dnd-kit/core')>()),
  DndContext: ({ children, onDragEnd }: { children: ReactNode; onDragEnd: (e: DragEndEvent) => void }) => {
    h.onDragEnd = onDragEnd;
    return <>{children}</>;
  },
}));
vi.mock('@/contexts/project-list-context', () => ({ useProjectList: () => h.list }));
vi.mock('@/contexts/storage-context', () => ({ useStorage: () => h.storage }));
vi.mock('@/contexts/active-project-context', () => ({ useActiveProject: () => ({ project: null }) }));
vi.mock('@/hooks/use-import-state', () => ({
  useImportState: () => ({
    flowPhase: { phase: 'idle' },
    applying: false,
    inputRef: { current: null },
    setDecision: vi.fn(),
    handleImportClick: vi.fn(),
    handleFileChange: vi.fn(),
    handleConfirmImport: vi.fn(),
    handleCancel: vi.fn(),
    handleReplaceConfirmed: vi.fn(),
    dismissReplaceConfirm: vi.fn(),
    handleDismissBanner: vi.fn(),
  }),
}));

import { ProjectsTab } from '../projects-tab';

const end = (active: string, over: string | null) =>
  ({ active: { id: active }, over: over === null ? null : { id: over } }) as unknown as DragEndEvent;

beforeEach(() => {
  h.list.projects = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }, { id: 'c', name: 'Gamma' }];
  h.list.moveProject.mockReset();
  h.onDragEnd = null;
});

it('a drop hands moveProject the dragged id, then the target id, once', () => {
  render(<ProjectsTab onOpenInCfd={vi.fn()} onOpenSample={vi.fn()} />);
  act(() => h.onDragEnd!(end('c', 'a')));
  expect(h.list.moveProject).toHaveBeenCalledTimes(1);
  expect(h.list.moveProject).toHaveBeenCalledWith('c', 'a', ['a', 'b', 'c']); // v0.21.0: the shown tiles (all, nothing archived here)
});

it('a drop on nothing, or on the tile itself, moves nothing', () => {
  render(<ProjectsTab onOpenInCfd={vi.fn()} onOpenSample={vi.fn()} />);
  act(() => h.onDragEnd!(end('c', null)));
  act(() => h.onDragEnd!(end('b', 'b')));
  expect(h.list.moveProject).not.toHaveBeenCalled();
});

it('with an archived tile hidden, the drop is made among the shown tiles only (v0.21.0, P2)', () => {
  h.prefsReady.prefs = { b: { archived: true } };
  try {
    render(<ProjectsTab onOpenInCfd={vi.fn()} onOpenSample={vi.fn()} />);
    act(() => h.onDragEnd!(end('c', 'a')));
    expect(h.list.moveProject).toHaveBeenCalledWith('c', 'a', ['a', 'c']);
  } finally {
    h.prefsReady.prefs = {};
  }
});
