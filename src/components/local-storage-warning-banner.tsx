// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect } from 'react';
import { useStorage } from '@/contexts/storage-context';
import { LS_SUPPRESS_LS_WARNING } from '@/lib/constants';

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

  const handleSuppress = () => {
    localStorage.setItem(LS_SUPPRESS_LS_WARNING, 'true');
    setVisible(false);
  };

  return (
    <div className="flex items-center gap-4 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <p className="flex-1">
        <strong>Your data exists only in this browser</strong> and can be lost
        without warning. Export at the end of every session to protect your work.
      </p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-amber-700">
          <input
            type="checkbox"
            checked={false}
            onChange={handleSuppress}
          />
          Don&apos;t show again
        </label>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-700"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
