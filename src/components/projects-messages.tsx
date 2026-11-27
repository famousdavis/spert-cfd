// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { buildBannerText } from '@/lib/import-utils';
import type { UseImportStateResult } from '@/hooks/use-import-state';

interface ProjectsMessagesProps {
  uiError: string | null;
  onDismissUiError: () => void;
  cloneStatus: string;
  onDismissClone: () => void;
  importFlowPhase: UseImportStateResult['flowPhase'];
  onDismissImportBanner: () => void;
}

/**
 * The Projects tab's message lines under the heading row, in this order: a
 * failed create, Load Sample or Clone; Clone's live region and its line; the
 * import error; the import success banner (v0.24.0, FRAME26 pass 3, C1: moved
 * from projects-tab.tsx unchanged; the state stays the tab's).
 */
export function ProjectsMessages({
  uiError,
  onDismissUiError,
  cloneStatus,
  onDismissClone,
  importFlowPhase,
  onDismissImportBanner,
}: ProjectsMessagesProps) {
  return (
    <>
      {/* A failed create, Load Sample or Clone (v0.19.0: storage full in O24's words) */}
      {uiError && (
        <div role="alert" className="sf-below flex items-center justify-between rounded bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-700 dark:text-red-100">
          <span>{uiError}</span>
          <button
            onClick={onDismissUiError}
            className="ml-4 text-red-500 dark:text-red-300 hover:text-red-700 dark:hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* v0.19.0 (DASH26 O19, Q3): Clone's words. The status region is always
          mounted, so its first message is announced, and sr-only, so an
          empty one takes no space in this column (+16 px measured with a
          visible empty one). The visible line repeats the words, hidden
          from screen readers so they are read once, beside a Dismiss that
          stays reachable; it renders only while there is text. */}
      <div role="status" aria-live="polite" className="sr-only" data-clone-status="">
        {cloneStatus}
      </div>
      {cloneStatus && (
        <div className="sf-below flex items-center justify-between rounded bg-green-50 dark:bg-green-900/30 px-4 py-2 text-sm text-green-700 dark:text-green-100">
          <span aria-hidden="true">{cloneStatus}</span>
          <button
            type="button"
            onClick={onDismissClone}
            aria-label="Dismiss clone message"
            className="ml-4 text-green-600 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Import error phase */}
      {importFlowPhase.phase === 'error' && (
        <div
          role="alert"
          className="sf-below flex items-center justify-between rounded bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm text-red-700 dark:text-red-100"
        >
          <span>{importFlowPhase.message}</span>
          <button
            onClick={onDismissImportBanner}
            className="ml-4 text-red-500 dark:text-red-300 hover:text-red-700 dark:hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Import success banner */}
      {importFlowPhase.phase === 'banner' && (
        <div
          role="status"
          className="sf-below flex items-center justify-between rounded bg-green-50 dark:bg-green-900/30 px-4 py-2 text-sm text-green-700 dark:text-green-100"
        >
          <span>{buildBannerText(importFlowPhase.outcome)}</span>
          <button
            onClick={onDismissImportBanner}
            className="ml-4 text-green-600 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200"
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
