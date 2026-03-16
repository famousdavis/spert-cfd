// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect } from 'react';
import { LS_FIRST_RUN_SEEN, TOS_URL, PRIVACY_URL } from '@/lib/constants';

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
    <div className="flex items-center gap-4 border-b border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <p className="flex-1">
        Statistical PERT&reg; apps are free. No account is required to use
        them. By accessing or using this app, you agree to our{' '}
        <a
          href={TOS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-700"
        >
          Terms of Service
        </a>
        {' '}and{' '}
        <a
          href={PRIVACY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-700"
        >
          Privacy Policy
        </a>
        . If you choose to enable optional Cloud Storage, you&apos;ll be
        asked to explicitly confirm your agreement.
      </p>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
      >
        Got it
      </button>
    </div>
  );
}
