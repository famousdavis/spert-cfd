// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import type { ChangeEvent } from 'react';
import { useImportState } from '../use-import-state';
import { useProjectList } from '@/contexts/project-list-context';
import { DATA_VERSION } from '@/lib/migrations';
import type { ImportMergeOutcome } from '@/lib/import-utils';
import type { ProjectListItem } from '@/lib/storage-driver';

// vi.mock is hoisted above imports. Module mock persists across all tests;
// per-test isolation is via beforeEach's mockReturnValue. vi.restoreAllMocks()
// restores vi.fn() spies but does NOT unmock modules — intentional.
vi.mock('@/contexts/project-list-context');

// ── Type aliases ─────────────────────────────────────────────────────────────

type ImportHookResult = { current: ReturnType<typeof useImportState> };

type MockReader = {
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null;
  result: string;
  readAsText: (file: Blob) => void;
};

// ── Fixtures ─────────────────────────────────────────────────────────────────

const EXISTING_PROJECT: ProjectListItem = { id: 'existing-1', name: 'Existing Project' };

function makeIncomingJson(overrides: { id?: string; name?: string } = {}): string {
  return JSON.stringify([{
    id: overrides.id ?? 'brand-new-id',
    name: overrides.name ?? 'New Project',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    workflow: [
      { id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 },
      { id: 'dev', name: 'In Dev', color: '#3b82f6', category: 'active', order: 1 },
      { id: 'done', name: 'Done', color: '#22c55e', category: 'done', order: 2 },
    ],
    snapshots: [],
    settings: {
      gridSortNewestFirst: true,
      showWipWarnings: true,
      metricsPeriod: { kind: 'all' },
    },
    _version: DATA_VERSION,
  }]);
}

function stubFileReader(json: string) {
  const mockReader: MockReader = {
    onload: null,
    onerror: null,
    result: json,
    readAsText: vi.fn().mockImplementation(function (this: MockReader) {
      this.onload?.call(
        this as unknown as FileReader,
        {} as ProgressEvent<FileReader>,
      );
    }),
  };
  // Regular function (not arrow) so `new FileReader()` succeeds.
  // Returning an object from a constructor overrides the freshly-allocated `this`.
  function MockFileReaderCtor(this: unknown): MockReader {
    return mockReader;
  }
  vi.stubGlobal('FileReader', MockFileReaderCtor);
}

function simulateFilePick(
  result: ImportHookResult,
  json: string,
  fileName = 'projects.json',
) {
  stubFileReader(json);
  const file = new File([json], fileName, { type: 'application/json' });
  const event = {
    target: { files: [file], value: '' },
  } as unknown as ChangeEvent<HTMLInputElement>;
  act(() => { result.current.handleFileChange(event); });
}

function makeContextValue(applyFn: (args: unknown) => Promise<ImportMergeOutcome>) {
  return {
    projects: [EXISTING_PROJECT],
    isLoaded: true,
    driverLoading: false,
    activeProjectId: 'existing-1',
    projectUpdateKey: 0,
    createProject: vi.fn(),
    deleteProject: vi.fn(),
    switchProject: vi.fn(),
    renameProject: vi.fn(),
    reorderProjects: vi.fn(),
    applyImportMerge: applyFn as ReturnType<typeof useProjectList>['applyImportMerge'],
  };
}

beforeEach(() => {
  vi.mocked(useProjectList).mockReturnValue(
    makeContextValue(vi.fn().mockResolvedValue({
      ok: true, added: 1, replaced: 0, skipped: 0,
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useImportState — behavioral guarantees', () => {
  // Case 1 (pitfall #59): Replace-confirm Cancel returns to preview, not idle
  it('replace-confirm Cancel returns to preview', () => {
    const { result } = renderHook(() => useImportState());
    simulateFilePick(result, makeIncomingJson({ id: 'different-id', name: 'Existing Project' }));
    expect(result.current.flowPhase.phase).toBe('preview');

    act(() => { result.current.setDecision('different-id', 'replace'); });
    act(() => { result.current.handleConfirmImport(); });
    expect(result.current.flowPhase.phase).toBe('replace-confirm');

    act(() => { result.current.dismissReplaceConfirm(); });
    expect(result.current.flowPhase.phase).toBe('preview');
  });

  // Case 2 (pitfall #59): applying is false after successful import
  it('applying is false after successful import', async () => {
    const { result } = renderHook(() => useImportState());
    simulateFilePick(result, makeIncomingJson());

    act(() => { result.current.handleConfirmImport(); });

    await waitFor(() => expect(result.current.applying).toBe(false));
    expect(result.current.flowPhase.phase).toBe('banner');
  });

  // Case 3 (pitfall #59): applying is false after drift abort
  it('applying is false after drift abort', async () => {
    vi.mocked(useProjectList).mockReturnValue(
      makeContextValue(vi.fn().mockResolvedValue({
        ok: false, added: 0, replaced: 0, skipped: 0, errorKind: 'drift',
      })),
    );
    const { result } = renderHook(() => useImportState());
    simulateFilePick(result, makeIncomingJson());

    act(() => { result.current.handleConfirmImport(); });

    await waitFor(() => expect(result.current.applying).toBe(false));
    expect(result.current.flowPhase.phase).toBe('error');
  });

  // Case 4 (pitfall #59): applying is false after write-failure
  it('applying is false after write-failure', async () => {
    vi.mocked(useProjectList).mockReturnValue(
      makeContextValue(vi.fn().mockResolvedValue({
        ok: false, added: 0, replaced: 0, skipped: 0, errorKind: 'write-failed',
      })),
    );
    const { result } = renderHook(() => useImportState());
    simulateFilePick(result, makeIncomingJson());

    act(() => { result.current.handleConfirmImport(); });

    await waitFor(() => expect(result.current.applying).toBe(false));
    expect(result.current.flowPhase.phase).toBe('error');
  });

  // Case 5 (pitfall #59): double-click fires applyImportMerge at most once.
  // The SOLE guard is `flushSync(() => setApplying(true))` inside applyMerge: it
  // synchronously commits applying=true between the two synchronous
  // handleConfirmImport calls (the second call reads the post-commit closure via
  // result.current's Proxy and bails out via `if (applying) return`). Without
  // flushSync, both calls race the same closure and BOTH invoke applyMerge;
  // pendingPreviewRef.current = null is not sufficient because each
  // handleConfirmImport re-populates the ref before its applyMerge runs.
  // Verified by L3 regression probe (CHANGELOG): commenting flushSync out flips
  // mockApply from 1 invocation to 2.
  it('double-click on Confirm fires applyImportMerge at most once', async () => {
    const mockApply = vi.fn().mockResolvedValue({
      ok: true, added: 1, replaced: 0, skipped: 0,
    });
    vi.mocked(useProjectList).mockReturnValue(makeContextValue(mockApply));
    const { result } = renderHook(() => useImportState());
    simulateFilePick(result, makeIncomingJson());

    act(() => {
      result.current.handleConfirmImport();
      result.current.handleConfirmImport();
    });

    await waitFor(() => expect(result.current.applying).toBe(false));
    expect(mockApply).toHaveBeenCalledTimes(1);
  });

  // Case 6: applying is false when applyImportMerge throws (exercises catch block)
  it('applying is false and error shown when applyImportMerge throws', async () => {
    vi.mocked(useProjectList).mockReturnValue(
      makeContextValue(vi.fn().mockRejectedValue(new Error('Network error'))),
    );
    const { result } = renderHook(() => useImportState());
    simulateFilePick(result, makeIncomingJson());

    act(() => { result.current.handleConfirmImport(); });

    await waitFor(() => expect(result.current.applying).toBe(false));
    expect(result.current.flowPhase.phase).toBe('error');
  });

  // Case 7 (C2): handleConfirmImport is a no-op when driverLoading is true.
  // Ordering invariant: the driverLoading guard runs BEFORE pendingPreviewRef.current
  // is set. A regression that moves the guard after the ref-set would populate the
  // ref with stale data on early return — future applyMerge calls could then process
  // it. This test catches the early-return but not the ref-set ordering; that
  // invariant must be maintained in the handleConfirmImport implementation.
  it('handleConfirmImport is a no-op when driverLoading is true', () => {
    const mockApply = vi.fn();
    vi.mocked(useProjectList).mockReturnValue({
      ...makeContextValue(mockApply),
      driverLoading: true,
    });
    const { result } = renderHook(() => useImportState());
    simulateFilePick(result, makeIncomingJson());
    expect(result.current.flowPhase.phase).toBe('preview');

    act(() => { result.current.handleConfirmImport(); });

    expect(mockApply).not.toHaveBeenCalled();
    expect(result.current.flowPhase.phase).toBe('preview');
  });

  // Case 8: handleCancel is unconditional (foundation for component-level Escape
  // gating). This test verifies the hook-level invariant that handleCancel always
  // succeeds regardless of driverLoading or any other state. The component-level
  // Escape-key gating (Escape → onCancel, guarded by !applying only) relies on
  // this invariant. Component-level Escape tests (including Escape during applying,
  // during driverLoading) are deferred to v0.14.0 — see SPEC_DEVIATIONS.md Deviation 5.
  it('handleCancel is unconditional — succeeds even when driverLoading is true', () => {
    vi.mocked(useProjectList).mockReturnValue({
      ...makeContextValue(vi.fn()),
      driverLoading: true,
    });
    const { result } = renderHook(() => useImportState());
    simulateFilePick(result, makeIncomingJson());
    expect(result.current.flowPhase.phase).toBe('preview');

    act(() => { result.current.handleCancel(); });

    expect(result.current.flowPhase.phase).toBe('idle');
  });
});
