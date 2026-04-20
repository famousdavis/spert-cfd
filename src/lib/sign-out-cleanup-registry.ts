// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Sign-out cleanup registry.
 *
 * AuthProvider wraps StorageProvider, so AuthContext cannot call
 * useStorage() directly. StorageProvider registers its zero-argument
 * cleanup function on mount; AuthProvider invokes runSignOutCleanup()
 * before firebaseSignOut, so the driver has a chance to cancel pending
 * writes and clear per-user localStorage while credentials are still
 * valid.
 *
 * Only one registrant (StorageProvider) — a single nullable slot, not
 * an array. Re-registration replaces the prior slot (idempotent under
 * React 18 StrictMode double-mount).
 */

type CleanupFn = () => Promise<void>;

let cleanup: CleanupFn | null = null;

/**
 * Register a sign-out cleanup function. Returns an unregister function
 * that nulls the slot only if it still holds the registered fn
 * (StrictMode double-mount safety).
 */
export function registerSignOutCleanup(fn: CleanupFn): () => void {
  if (cleanup && cleanup !== fn) {
    console.warn(
      'signOutCleanupRegistry: replacing an existing registration. ' +
        'Only one registrant (StorageProvider) is expected.',
    );
  }
  cleanup = fn;
  return () => {
    if (cleanup === fn) cleanup = null;
  };
}

/**
 * Run the registered cleanup function. Resolves immediately if nothing
 * is registered. Rejections propagate to the caller.
 */
export async function runSignOutCleanup(): Promise<void> {
  if (cleanup) await cleanup();
}
