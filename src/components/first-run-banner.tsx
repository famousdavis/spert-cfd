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
    <div className="border-b border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <p>
        Statistical PERT&reg; apps are free to use. No account is required.
        If you choose to enable optional Cloud Storage, you will be asked
        to review and agree to our{' '}
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
        .
      </p>
      <button
        onClick={handleDismiss}
        className="mt-2 rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
      >
        Got it
      </button>
    </div>
  );
}
