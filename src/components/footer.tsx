// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import Link from 'next/link';
import { APP_VERSION, TOS_URL, PRIVACY_URL } from '@/lib/constants';

export function Footer() {
  return (
    <footer className="border-t border-gray-200 py-3 text-center text-xs text-gray-500">
      <div>
        &copy; {new Date().getFullYear()} William W. Davis, MSPM, PMP |{' '}
        <Link
          href="/changelog"
          className="text-blue-600 hover:text-blue-700"
        >
          Version {APP_VERSION}
        </Link>{' '}
        | Licensed under GNU GPL v3
      </div>
      <div className="mt-1">
        <a
          href={TOS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700"
        >
          Terms of Service
        </a>
        {' | '}
        <a
          href={PRIVACY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700"
        >
          Privacy Policy
        </a>
      </div>
    </footer>
  );
}
