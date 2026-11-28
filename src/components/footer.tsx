// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import Link from 'next/link';
import { APP_VERSION, SPERT_SUITE_URL, TOS_URL, PRIVACY_URL, LICENSE_URL } from '@/lib/constants';
import { CopyrightYear } from '@/lib/copyright';

/**
 * The frame's footer (FRAME26, contract §3, v0.22.0): a full-width 69 px band
 * with a 1 px top rule and two centred lines, flowing after `main` (pinned at
 * the window's bottom only on the CFD tab, exception X1). Wording and
 * destinations are unchanged. The links' colour is the frame's `--sf-link`
 * (`#155dfc` / `#51a2ff`: 5.25 and 6.73 : 1 on the page ground; until v0.22.0
 * the dark links were `blue-600`, 3.38 : 1) and their hover underline is the
 * frame's too, never a utility here: the stylesheet is unlayered, so a utility
 * would lose anyway. `footer-frame.test.tsx` holds it.
 */
export function Footer() {
  return (
    <footer className="sf-footer" data-sf="footer">
      <div className="sf-col">
        <div>
          &copy; <CopyrightYear /> William W. Davis, MSPM, PMP |{' '}
          <Link href="/changelog">Version {APP_VERSION}</Link>{' '}
          | Licensed under GNU GPL v3
        </div>
        <div>
          <a href={SPERT_SUITE_URL} target="_blank" rel="noopener noreferrer">
            SPERT® Suite
          </a>
          {' | '}
          <a href={TOS_URL} target="_blank" rel="noopener noreferrer">
            Terms of Service
          </a>
          {' | '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
          {' | '}
          <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer">
            License
          </a>
        </div>
      </div>
    </footer>
  );
}
