// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useStorage } from '@/contexts/storage-context';
import { useAuth } from '@/contexts/auth-context';
import { getFirstName } from '@/lib/user-display';
import { APP_DESCRIPTION } from '@/lib/constants';
import { PAGE_COLUMN } from './page-column';
import { HeaderThemeToggle } from './theme-toggle';

interface AppHeaderProps {
  onOpenModal: () => void;
}

// v0.20.1 (DASH26 RT, HDR26): the title's two words, each a gradient in CFD's
// own favicon purple, one pair of ends per theme, and every point of each at
// least 3:1 on the page behind it (#ffffff in light, #101828 in dark).
// Printed, it is solid near-black; when the computer asks for more contrast,
// it takes the page's own text colours. One literal string, kept on one line:
// a class name built from a variable compiles to nothing, and over clear text
// the title would then disappear. No size or weight here: the <h1> carries
// the weight, so the space between the words, the <h1>'s own text, is set in
// the words' weight and keeps its width. Guarded by
// __tests__/title-gradient.test.tsx.
const TITLE_GRADIENT =
  'bg-gradient-to-r from-[#9468fd] to-[#6117c5] dark:from-[#aa8fff] dark:to-[#783de3] bg-clip-text text-transparent print:bg-none print:text-black contrast-more:bg-none contrast-more:text-black dark:contrast-more:text-gray-100';

function CloudIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"
        fill="#0070f3"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="#9CA3AF" strokeWidth="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function AppHeader({ onOpenModal }: AppHeaderProps) {
  const { mode } = useStorage();
  const { user } = useAuth();

  const isCloudSignedIn = mode === 'cloud' && !!user;
  const isSignedInLocal = !!user && mode !== 'cloud';

  const firstName = getFirstName(user?.displayName, user?.email);
  const initial = firstName.charAt(0).toUpperCase();

  const pillBorderStyle = { border: '0.5px solid #D1D5DB' } as const;
  const dividerStyle = { width: '0.5px', backgroundColor: '#D1D5DB' } as const;

  return (
    // In the page's column with the tabs, not a full-width bar (as in GanttApp).
    // v0.17.9: the SPERT® suite's header, as SPERT® Forecaster draws it: the
    // gradient title (v0.20.1: in CFD's own purple, above) over an italic
    // tagline, 60px tall, the sign-in chip top-right. The spacing is CFD's own, kept compact: 12px above and below
    // (`my-3`, outside the 60px box; the siblings use 32px above and 24px
    // below), so the CFD tab's chart and grid lose as little height as they
    // can. `leading-[normal]` is the CSS `normal` line-height (Tailwind's
    // own "normal" leading is 1.5). Without it, `md:text-[2.1rem]` sets only the
    // font size, and the title keeps `text-2xl`'s line-height ratio, 2/1.5.
    <header className={`${PAGE_COLUMN} my-3 flex items-start justify-between`}>
      <div>
        <div className="mb-1 flex items-center gap-3">
          {/* v0.19.1 (DASH26 RD1, O29): the dark logo in dark, as the suite's
              header does. Two images switched by the `dark` class, so CSS
              alone picks one and no script has to know the theme; the one
              not shown is `display: none`. The browser tab's icon stays. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/spert-favicon-cfd.png"
            alt="SPERT CFD icon"
            className="mr-2 h-7 w-7 rounded-lg ring-1 ring-white/20 dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/spert-favicon-cfd-dark.png"
            alt="SPERT CFD icon"
            className="mr-2 hidden h-7 w-7 rounded-lg ring-1 ring-white/20 dark:block"
          />
          <h1 className="text-2xl sm:text-[1.75rem] md:text-[2.1rem] leading-[normal] whitespace-nowrap font-bold">
            <span className={TITLE_GRADIENT}>SPERT</span>
            <span className="text-gray-400 dark:text-gray-500 font-normal text-base sm:text-lg align-top">®</span>
            {' '}<span className={TITLE_GRADIENT}>CFD</span>
          </h1>
        </div>
        <p className="text-sm leading-[normal] text-gray-500 dark:text-gray-400 italic">{APP_DESCRIPTION}</p>
      </div>

      {/* The right-hand group, as Forecaster's: the theme switch (v0.20.0,
          DASH26 RD2), then the sign-in chip, transparent at rest as in
          Forecaster (it was white). */}
      <div className="flex items-center gap-2">
      <HeaderThemeToggle />
      {isCloudSignedIn ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label="Account menu"
          onClick={onOpenModal}
          className="flex items-center rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          style={pillBorderStyle}
        >
          {/* Left segment: avatar + first name */}
          <span className="flex items-center gap-1.5 py-1 pl-1 pr-2.5">
            <span
              className="flex items-center justify-center rounded-full text-white shrink-0"
              style={{
                width: 26,
                height: 26,
                backgroundColor: '#0070f3',
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {initial}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500 }} className="text-gray-900 dark:text-gray-100">
              {firstName}
            </span>
          </span>
          {/* Vertical divider */}
          <span className="self-stretch" style={dividerStyle} />
          {/* Right segment: cloud icon (visual only) */}
          <span className="flex items-center justify-center px-2.5 py-1">
            <CloudIcon />
          </span>
        </button>
      ) : isSignedInLocal ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label="Account menu"
          onClick={onOpenModal}
          className="flex items-center rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          style={pillBorderStyle}
        >
          {/* Left segment: avatar + first name */}
          <span className="flex items-center gap-1.5 py-1 pl-1 pr-2.5">
            <span
              className="flex items-center justify-center rounded-full text-white shrink-0"
              style={{
                width: 26,
                height: 26,
                backgroundColor: '#0070f3',
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {initial}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500 }} className="text-gray-900 dark:text-gray-100">
              {firstName}
            </span>
          </span>
          {/* Vertical divider */}
          <span className="self-stretch" style={dividerStyle} />
          {/* Right segment: lock icon (visual only) */}
          <span className="flex items-center justify-center px-2.5 py-1">
            <LockIcon />
          </span>
        </button>
      ) : (
        <button
          type="button"
          aria-label="Sign in"
          onClick={onOpenModal}
          className="flex items-center rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          style={pillBorderStyle}
        >
          {/* Left segment: lock icon + "Local only" */}
          <span className="flex items-center gap-1.5 py-1 pl-2.5 pr-2.5">
            <LockIcon />
            <span style={{ fontSize: 13 }} className="text-gray-400">
              Local only
            </span>
          </span>
          {/* Vertical divider */}
          <span className="self-stretch" style={dividerStyle} />
          {/* Right segment: "Sign in" (visual only) */}
          <span className="flex items-center justify-center px-2.5 py-1">
            <span style={{ fontSize: 12, fontWeight: 500, color: '#0070f3' }}>Sign in</span>
          </span>
        </button>
      )}
      </div>
    </header>
  );
}
