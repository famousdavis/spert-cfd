// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect } from 'react';
import { useStorage } from '@/contexts/storage-context';
import { LS_SUPPRESS_LS_WARNING } from '@/lib/constants';

/**
 * The local-storage caution. Shown on each page load while storage is local,
 * unless the user turned it off. "Got it" hides it until the next page load.
 * v0.17.0: the only permanent off-switch is "Warn me on startup when using
 * local storage" (Settings, and the Cloud Storage window); the inline
 * "Don't show again" checkbox is gone.
 */
export function LocalStorageWarningBanner() {
  const { driver } = useStorage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const suppressed = localStorage.getItem(LS_SUPPRESS_LS_WARNING);
    if (suppressed !== 'true') {
      setVisible(true); // eslint-disable-line react-hooks/set-state-in-effect -- SSR-safe deferred load from localStorage
    }
  }, []);

  // Cloud mode: localStorage warning is irrelevant
  if (driver.mode === 'cloud') return null;
  if (!visible) return null;

  const handleDismiss = () => setVisible(false);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-3">
      <div className="flex items-center gap-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="flex-1">
          <strong>Your data exists only in this browser</strong> and can be lost
          without warning. Export at the end of every session to protect your work.
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded border border-amber-600 px-3 py-1 text-xs text-amber-700 hover:bg-amber-100"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
