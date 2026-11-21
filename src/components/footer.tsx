// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import Link from 'next/link';
import { APP_VERSION, SPERT_SUITE_URL, TOS_URL, PRIVACY_URL, LICENSE_URL } from '@/lib/constants';

export function Footer() {
  // v0.19.1 (DASH26 RD1, O30): the links keep SPERT® Forecaster's colour in
  // dark too (3.4:1 there, a suite-wide shortfall), written out as `dark:`
  // classes so the choice is visible.
  return (
    <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-3 text-sm text-gray-500 dark:text-gray-400">
      <div className="mx-auto w-full max-w-7xl px-4 text-center">
        <div>
          &copy; {new Date().getFullYear()} William W. Davis, MSPM, PMP |{' '}
          <Link
            href="/changelog"
            className="text-blue-600 dark:text-blue-600 hover:text-blue-700 dark:hover:text-blue-700"
          >
            Version {APP_VERSION}
          </Link>{' '}
          | Licensed under GNU GPL v3
        </div>
        <div className="mt-1">
          <a
            href={SPERT_SUITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-600 hover:text-blue-700 dark:hover:text-blue-700"
          >
            SPERT® Suite
          </a>
          {' | '}
          <a
            href={TOS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-600 hover:text-blue-700 dark:hover:text-blue-700"
          >
            Terms of Service
          </a>
          {' | '}
          <a
            href={PRIVACY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-600 hover:text-blue-700 dark:hover:text-blue-700"
          >
            Privacy Policy
          </a>
          {' | '}
          <a
            href={LICENSE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-600 hover:text-blue-700 dark:hover:text-blue-700"
          >
            License
          </a>
        </div>
      </div>
    </footer>
  );
}
