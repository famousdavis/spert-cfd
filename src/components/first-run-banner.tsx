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
    // v0.22.0 (FRAME26): the frame's info notice, a direct child of the
    // notices slot, full column width, with its outlined "Got it"
    // (`.sf-notice-dismiss`). Its links take the notice's own colour, underlined
    // (the frame's `.sf-notice a`).
    <div className="sf-notice sf-notice--info">
      <p className="flex-1">
        SPERT&reg; Suite web apps are free to use. No account is required to
        use them. By accessing or using this app, you agree to our{' '}
        <a
          href={TOS_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms of Service
        </a>
        {' '}and{' '}
        <a
          href={PRIVACY_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy
        </a>
        . If you choose to enable optional Cloud Storage, you&apos;ll be
        asked to explicitly confirm your agreement.
      </p>
      <button type="button" onClick={handleDismiss} className="sf-notice-dismiss">
        Got it
      </button>
    </div>
  );
}
