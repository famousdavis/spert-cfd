// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import Link from 'next/link';
import { HeadingRow } from '@/components/heading-row';

/**
 * Any address no route matches (FRAME26, v0.22.0), in SPERT® MyScrumBudget's
 * and Scheduler's words. Until then Next's own 404 showed an `h1` "404" in a
 * box as tall as the window, with no frame; inside the frame's `main` that box
 * would push the footer a window down. Contract §7 keeps a view's error inside
 * `main` with the frame intact. No navigation item leads here, so none is
 * active. Nothing in the app links to an unknown address, so a 404 is a fresh
 * load and "/" opens on Projects.
 */
export default function NotFound() {
  return (
    <>
      <HeadingRow>Page not found</HeadingRow>
      <div className="sf-below">
        <p>There&apos;s no page at this address.</p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Back to Projects
        </Link>
      </div>
    </>
  );
}
