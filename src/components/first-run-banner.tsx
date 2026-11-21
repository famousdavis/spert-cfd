// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect } from 'react';
import { LS_FIRST_RUN_SEEN, TOS_URL, PRIVACY_URL } from '@/lib/constants';
import { PAGE_COLUMN } from './page-column';

export function FirstRunBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(LS_FIRST_RUN_SEEN);
    if (seen !== 'true') {
      setVisible(true); // eslint-disable-line react-hooks/set-state-in-effect -- SSR-safe deferred load from localStorage
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(LS_FIRST_RUN_SEEN, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    // v0.17.0: a card, not a full-width strip, with an outlined "Got it" —
    // the look of the suite's app-wide notices.
    <div className={`${PAGE_COLUMN} pt-3`}>
      <div className="flex items-center gap-4 rounded-md border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 px-4 py-3 text-sm text-blue-800 dark:text-gray-200">
        <p className="flex-1">
          SPERT&reg; Suite web apps are free to use. No account is required to
          use them. By accessing or using this app, you agree to our{' '}
          <a
            href={TOS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-300 underline hover:text-blue-700 dark:hover:text-blue-200"
          >
            Terms of Service
          </a>
          {' '}and{' '}
          <a
            href={PRIVACY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-300 underline hover:text-blue-700 dark:hover:text-blue-200"
          >
            Privacy Policy
          </a>
          . If you choose to enable optional Cloud Storage, you&apos;ll be
          asked to explicitly confirm your agreement.
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded border border-blue-600 dark:border-blue-600 px-3 py-1 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
