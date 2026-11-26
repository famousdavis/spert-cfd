// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import type { MouseEvent } from 'react';
import Link from 'next/link';
import { useStorage } from '@/contexts/storage-context';
import { useAuth } from '@/contexts/auth-context';
import { getFirstName } from '@/lib/user-display';
import { APP_DESCRIPTION } from '@/lib/constants';
import { HeaderThemeToggle } from './theme-toggle';

/*
 * The frame's brand row (FRAME26, contract §3, v0.22.0): a 56 px band on the
 * page ground, in the shared 1600 px column. It replaces v0.17.9's header and
 * DASH26 R17's compact spacing (contract §8: superseded by the frame).
 *
 * The brand is ONE LINK to the collection screen. CFD's tabs are in-memory
 * state, and "/" with no other state is the Projects tab, so the link points
 * at "/" and, on a plain click, handles the navigation itself (show Projects,
 * and leave another route such as /changelog): its `preventDefault` stops
 * Next's `<Link>` from navigating too. A modified or middle click is left to
 * the browser, which opens Projects in a new tab. It has no aria-label: its
 * accessible name is its visible title, "SPERT® CFD" (WCAG 2.5.3, label in
 * name). Both favicons are decorative (`alt=""`) for the same reason; the
 * stylesheet shows the one for the current theme (`.sf-icon--light` /
 * `--dark`, v0.19.1's two images, O29), so no script has to know the theme.
 *
 * The title is NOT a heading: the page's one `h1` is the heading row's, in
 * `main` (contract §2).
 *
 * The title's colour (HDR26, DASH26 RT, v0.20.1; on the frame since v0.22.0):
 * CFD's favicon purple, a gradient on each word ("SPERT", "CFD") drawn by the
 * frame's `.sf-grad` from `--app-grad-light` / `--app-grad-dark` in
 * globals.css. The ® between them is the frame's muted `.sf-mark`. Each ramp
 * is at least 3 : 1 at every point on the page ground, because the title is
 * 24 px bold, large text: weakest 3.71 in light, 3.02 in dark. For the same
 * reason the brand has no hover fade or ground of its own. The fallbacks are
 * the frame's: solid `--sf-heading` under `prefers-contrast: more`, black in
 * print. Guarded by __tests__/title-gradient.test.tsx.
 *
 * The space before "CFD" sits OUTSIDE the gradient spans, as text of the
 * title: inside a span, jsdom's accessible-name computation trims it.
 */

interface AppHeaderProps {
  /** Shows the Projects tab (and leaves any other route). */
  onNavigateHome: () => void;
  /** Opens Cloud Storage from the account chip. */
  onOpenModal: () => void;
  /**
   * True while the app is still loading (contract §7: the frame renders first).
   * Cloud Storage needs the project list, so the chip is announced as
   * unavailable (`aria-disabled`), stays focusable and in its resting look, and
   * a click does nothing until the load ends.
   */
  accountUnavailable?: boolean;
}

/** The lock and the cloud draw in `currentColor`: the segment's own colour. */
function CloudIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"
        fill="currentColor"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function AppHeader({ onNavigateHome, onOpenModal, accountUnavailable = false }: AppHeaderProps) {
  const { mode } = useStorage();
  const { user } = useAuth();

  const isCloudSignedIn = mode === 'cloud' && !!user;
  const isSignedIn = !!user;

  const firstName = getFirstName(user?.displayName, user?.email);
  const initial = firstName.charAt(0).toUpperCase();

  const handleBrandClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigateHome();
  };

  // The account chip (contract §3 and §7): the frame's `.sf-chip`, 30 px tall,
  // its right edge at R, with the state on the left and the action on the
  // right. Names and wording are v0.17.9's. Its colours are the frame's tokens:
  // "Local only" and the lock in the muted colour (4.84 / 6.82; until v0.22.0
  // "Local only" was gray-400, 2.60 on white), "Sign in" and the cloud in the
  // link colour (5.25 / 6.73; was #0070f3, 3.90 in dark).
  const chipProps = {
    type: 'button' as const,
    className: 'sf-chip',
    'data-sf': 'chip',
    'aria-disabled': accountUnavailable ? (true as const) : undefined,
    onClick: accountUnavailable ? undefined : onOpenModal,
  };

  return (
    <header className="sf-bar">
      <div className="sf-col sf-bar-row">
        <Link href="/" onClick={handleBrandClick} className="sf-brand" data-sf="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/spert-favicon-cfd.png"
            alt=""
            className="sf-icon sf-icon--light ring-1 ring-white/20"
            data-sf="favicon"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/spert-favicon-cfd-dark.png"
            alt=""
            className="sf-icon sf-icon--dark ring-1 ring-white/20"
            data-sf="favicon"
          />
          <span className="sf-title" data-sf="title">
            <span className="sf-grad">SPERT</span><span className="sf-mark">®</span>{' '}<span className="sf-grad">CFD</span>
          </span>
        </Link>
        <p className="sf-tagline" data-sf="tagline">{APP_DESCRIPTION}</p>
        <div className="sf-utils" data-sf="utils">
          <HeaderThemeToggle />
          {isSignedIn ? (
            <button {...chipProps} aria-haspopup="dialog" aria-label="Account menu">
              <span className="sf-chip-state">
                <span
                  className="flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-medium text-white"
                  style={{ backgroundColor: '#0070f3' }}
                >
                  {initial}
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{firstName}</span>
              </span>
              {/* Cloud: the link colour. Signed in but local: the lock, muted like the signed-out chip's. */}
              <span className="sf-chip-act">
                {isCloudSignedIn ? <CloudIcon /> : <span className="flex text-(--sf-text-muted)"><LockIcon /></span>}
              </span>
            </button>
          ) : (
            <button {...chipProps} aria-label="Sign in">
              <span className="sf-chip-state">
                <LockIcon />
                <span>Local only</span>
              </span>
              <span className="sf-chip-act">Sign in</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
