// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * App data reset registry.
 *
 * ProjectListContext and ActiveProjectContext are children of
 * StorageProvider. On sign-out, StorageProvider needs to synchronously
 * zero their in-memory state BEFORE the storage swap completes —
 * otherwise the prior user's project data flashes in the UI for a
 * render tick. Each data context registers a synchronous reset
 * callback on mount; StorageProvider's cleanup calls runDataReset()
 * as its first step.
 *
 * A Set is used so double-registration under StrictMode is
 * idempotent and unregister is O(1). Failures in one reset must not
 * prevent others from running.
 */

type ResetFn = () => void;

const resets = new Set<ResetFn>();

export function registerDataReset(fn: ResetFn): () => void {
  resets.add(fn);
  return () => {
    resets.delete(fn);
  };
}

export function runDataReset(): void {
  for (const fn of resets) {
    try {
      fn();
    } catch (err) {
      console.error(
        'appDataResetRegistry: reset fn threw',
        (err as { code?: string }).code ?? err,
      );
    }
  }
}
