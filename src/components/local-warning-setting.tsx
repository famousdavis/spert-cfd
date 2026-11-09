// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useEffect, useState } from 'react';
import { LS_SUPPRESS_LS_WARNING } from '@/lib/constants';

/**
 * v0.17.0: the permanent off-switch for the local-storage caution, on the
 * same key as the Cloud Storage window's Notifications switch. Takes effect
 * from the next page load, as that one does.
 */
export function LocalWarningSetting() {
  const [warn, setWarn] = useState(true);

  // Hydrate from localStorage post-mount (SSR safe).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe hydration of localStorage into state
    setWarn(localStorage.getItem(LS_SUPPRESS_LS_WARNING) !== 'true');
  }, []);

  const handleChange = (next: boolean) => {
    setWarn(next);
    if (next) {
      localStorage.removeItem(LS_SUPPRESS_LS_WARNING);
    } else {
      localStorage.setItem(LS_SUPPRESS_LS_WARNING, 'true');
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 mt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Notifications</h3>
      <div className="flex items-start gap-3">
        <input
          id="settings-warn-local-storage"
          name="settings-warn-local-storage"
          type="checkbox"
          checked={warn}
          onChange={(e) => handleChange(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-blue-600"
        />
        <div>
          <label htmlFor="settings-warn-local-storage" className="cursor-pointer text-sm text-gray-900">
            Warn me on startup when using local storage
          </label>
          <p className="mt-0.5 text-xs text-gray-500">
            Shows a caution banner each time the app opens while your data is stored locally in this browser.
          </p>
        </div>
      </div>
    </section>
  );
}
