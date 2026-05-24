// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Project } from '@/types';
import { MAX_IMPORT_FILE_SIZE } from '@/lib/constants';
import { useProjectList } from '@/contexts/project-list-context';
import {
  processImportData,
  type ConflictResolution,
  type ImportConflict,
  type ImportDecisions,
  type ImportMergeOutcome,
} from '@/lib/import-utils';

// ── Flow phases ──────────────────────────────────────────

type FlowPhase =
  | { phase: 'idle' }
  | {
      phase: 'preview';
      incoming: Project[];
      conflicts: ImportConflict[];
      decisions: ImportDecisions;
    }
  | { phase: 'replace-confirm' }
  | { phase: 'banner'; outcome: ImportMergeOutcome }
  | { phase: 'error'; message: string };

interface PendingPreview {
  incoming: Project[];
  conflicts: ImportConflict[];
  decisions: ImportDecisions;
}

export interface UseImportStateResult {
  flowPhase: FlowPhase;
  applying: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setDecision: (projectId: string, resolution: ConflictResolution) => void;
  handleImportClick: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleConfirmImport: () => void;
  handleCancel: () => void;
  handleReplaceConfirmed: () => void;
  dismissReplaceConfirm: () => void;
  handleDismissBanner: () => void;
}

/**
 * State machine for the multi-project import flow.
 *
 * Phases: idle → preview → (replace-confirm →)? applyMerge → banner | error.
 *
 * `applying` is set true exclusively inside applyMerge's body and reset to
 * false in its finally block. No transition helper touches it. The phase
 * change itself prevents double-click on Confirm; `applying` is a secondary
 * guard for any future code paths that might bypass a transition.
 */
export function useImportState(): UseImportStateResult {
  // ── State + refs ────────────────────────────────────────
  const [flowPhase, setFlowPhase] = useState<FlowPhase>({ phase: 'idle' });
  const [applying, setApplying] = useState(false);
  const pendingPreviewRef = useRef<PendingPreview | null>(null);
  const readerRef = useRef<FileReader | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ── useProjectList ──────────────────────────────────────
  const { projects, driverLoading, applyImportMerge } = useProjectList();

  // ── Transition helpers (all [] deps; no setApplying calls) ─────
  const showPreview = useCallback(
    (incoming: Project[], conflicts: ImportConflict[]) => {
      const defaults: ImportDecisions = new Map(
        conflicts.map((c) => [c.incoming.id, 'skip' as ConflictResolution]),
      );
      setFlowPhase({ phase: 'preview', incoming, conflicts, decisions: defaults });
    },
    [],
  );

  const showBanner = useCallback((outcome: ImportMergeOutcome) => {
    setFlowPhase({ phase: 'banner', outcome });
  }, []);

  const showError = useCallback((message: string) => {
    setFlowPhase({ phase: 'error', message });
  }, []);

  const showReplaceConfirm = useCallback(() => {
    setFlowPhase({ phase: 'replace-confirm' });
  }, []);

  const clearImportFlow = useCallback(() => {
    setFlowPhase({ phase: 'idle' });
  }, []);

  const restorePreviewFromPending = useCallback(() => {
    const pending = pendingPreviewRef.current;
    // Ref is NOT cleared — user may re-review and re-confirm.
    if (!pending) {
      setFlowPhase({ phase: 'idle' });
      return;
    }
    setFlowPhase({
      phase: 'preview',
      incoming: pending.incoming,
      conflicts: pending.conflicts,
      decisions: pending.decisions,
    });
  }, []);

  // ── Reader cleanup ──────────────────────────────────────
  const resetReaderState = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.onload = null;
      readerRef.current.onerror = null;
      readerRef.current = null;
    }
    setApplying(false);
  }, []);

  // ── applyMerge — MUST precede handleConfirmImport ───────
  const applyMerge = useCallback(async () => {
    // Capture and clear immediately — prevents stale data on retry.
    const pending = pendingPreviewRef.current;
    pendingPreviewRef.current = null;
    if (!pending) {
      // Same-tick double-click where the first call already captured the ref.
      // Silent no-op — do NOT show an error banner for a successful import
      // already in flight.
      return;
    }
    // flushSync ensures applying=true is committed to the DOM before the synchronous
    // import work begins. Without it, aria-busy on the Confirm button and the
    // "Importing…" label are not observable to assistive tech before the merge starts
    // (pitfall #86). Outside the try block so a flushSync throw — extremely rare —
    // does not skip the finally's setApplying(false) reset.
    flushSync(() => setApplying(true));
    try {
      const { incoming, conflicts: originalConflicts, decisions } = pending;
      const outcome = await applyImportMerge({ incoming, decisions, originalConflicts });
      if (!outcome.ok) {
        showError(
          outcome.errorKind === 'write-failed'
            ? 'Projects could not be saved. Please check your connection and try again.'
            : 'The project list changed while you were reviewing. Please re-import the file.',
        );
        return;
      }
      showBanner(outcome);
    } catch {
      showError('Import failed unexpectedly. Please try again.');
    } finally {
      // Primary applying reset. try/finally is robust against future code
      // paths that bypass a transition.
      setApplying(false);
    }
  }, [applyImportMerge, showBanner, showError]);

  // ── handleConfirmImport — depends on applyMerge ─────────
  const handleConfirmImport = useCallback(() => {
    if (flowPhase.phase !== 'preview') return;
    if (applying) return;
    // C2: Drop Confirm on the floor while the project list is hydrating from a
    // driver swap (e.g., mid-session cloud-mode activation). Conflict detection
    // ran against a stale list; proceeding could create duplicates or clobber
    // cloud projects that the dashboard hasn't surfaced yet. Guard runs BEFORE
    // pendingPreviewRef.current is set so a guarded call leaves no stale ref.
    if (driverLoading) return;
    const { incoming, conflicts, decisions } = flowPhase;
    pendingPreviewRef.current = { incoming, conflicts, decisions };
    // setApplying(true) is NOT called here. The phase change itself prevents
    // the Confirm button from being re-clickable; `applying` cannot serve as
    // a within-tick guard due to React closure capture. The null-pending
    // no-op in applyMerge silently absorbs any second microtask that fires.
    const hasAnyReplace = [...decisions.values()].some((v) => v === 'replace');
    if (hasAnyReplace) {
      showReplaceConfirm();
      return;
    }
    void applyMerge();
  }, [flowPhase, applying, driverLoading, showReplaceConfirm, applyMerge]);

  // ── handleReplaceConfirmed — depends on applyMerge ──────
  const handleReplaceConfirmed = useCallback(() => {
    if (flowPhase.phase !== 'replace-confirm') return;
    if (applying) return; // applying is provably false here; defensive guard
    void applyMerge();
  }, [flowPhase, applying, applyMerge]);

  // ── Remaining handlers ──────────────────────────────────
  const setDecision = useCallback(
    (projectId: string, resolution: ConflictResolution) => {
      setFlowPhase((prev) => {
        if (prev.phase !== 'preview') return prev;
        const next = new Map(prev.decisions);
        next.set(projectId, resolution);
        return { ...prev, decisions: next };
      });
    },
    [],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // allow re-pick of the same filename
      if (!file) return;

      // File-type validation: .json extension is PRIMARY and REQUIRED.
      // MIME type (file.type === 'application/json') is SECONDARY and
      // intentionally permissive — it's unreliable cross-browser:
      //   - Safari often reports '' for .json files
      //   - Some Linux Firefox installs report 'text/plain'
      //   - Windows Edge reports 'application/json' consistently
      // DO NOT make MIME required. The extension check is the real guard;
      // the MIME check only kicks in to reject obvious mismatches (e.g.,
      // a renamed binary that the OS tagged as 'application/octet-stream').
      const nameLower = file.name.toLowerCase();
      if (!nameLower.endsWith('.json')) {
        showError('Only .json files are supported.');
        return;
      }
      if (
        file.type &&
        file.type !== 'application/json' &&
        file.type !== 'text/plain' &&
        file.type !== ''
      ) {
        showError('File does not appear to be JSON.');
        return;
      }
      if (file.size > MAX_IMPORT_FILE_SIZE) {
        showError('File is too large. Maximum size is 5 MB.');
        return;
      }

      // Cancel any prior in-flight reader before starting a new one.
      resetReaderState();

      const reader = new FileReader();
      readerRef.current = reader;
      reader.onload = () => {
        if (readerRef.current !== reader) return; // superseded
        readerRef.current = null;
        const json = reader.result as string;
        const parsed = processImportData(json, projects);
        if (!parsed.ok) {
          showError(parsed.reason);
          return;
        }
        if (parsed.incoming.length === 0) {
          showError('The file contains no projects to import.');
          return;
        }
        showPreview(parsed.incoming, parsed.conflicts);
      };
      reader.onerror = () => {
        if (readerRef.current !== reader) return;
        readerRef.current = null;
        showError('Failed to read file. Please try again.');
      };
      // FileReader.readAsText can throw synchronously (e.g. InvalidStateError).
      // Without this catch the exception escapes the React event handler and the
      // reader handle is leaked; showing an error banner here keeps the UI honest
      // and lets the user try again (pitfall #48).
      try {
        reader.readAsText(file);
      } catch (err) {
        if (readerRef.current === reader) readerRef.current = null;
        const detail = err instanceof Error ? err.message : 'Unknown error';
        showError(`Failed to read file: ${detail}`);
      }
    },
    [projects, resetReaderState, showError, showPreview],
  );

  const handleCancel = useCallback(() => {
    pendingPreviewRef.current = null;
    clearImportFlow();
  }, [clearImportFlow]);

  const dismissReplaceConfirm = useCallback(() => {
    // Phase check is sufficient — applying is provably false in replace-confirm
    // phase (only applyMerge sets it true, and applyMerge hasn't run yet).
    if (flowPhase.phase !== 'replace-confirm') return;
    restorePreviewFromPending();
  }, [flowPhase.phase, restorePreviewFromPending]);

  const handleDismissBanner = useCallback(() => {
    clearImportFlow();
  }, [clearImportFlow]);

  const handleImportClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return {
    flowPhase,
    applying,
    inputRef,
    setDecision,
    handleImportClick,
    handleFileChange,
    handleConfirmImport,
    handleCancel,
    handleReplaceConfirmed,
    dismissReplaceConfirm,
    handleDismissBanner,
  };
}
