// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useRef, useState } from 'react';
import { useStorage } from '@/contexts/storage-context';
import { useAuth } from '@/contexts/auth-context';
import { getFirstName } from '@/lib/user-display';
import { SignOutPopover } from './sign-out-popover';
import { SignedInLocalPopover } from './signed-in-local-popover';

interface AppHeaderProps {
  onNavigateToSettings: () => void;
}

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

export function AppHeader({ onNavigateToSettings }: AppHeaderProps) {
  const { mode } = useStorage();
  const { user, signOut } = useAuth();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);

  const isCloudSignedIn = mode === 'cloud' && !!user;
  const isSignedInLocal = !!user && mode !== 'cloud';

  const firstName = getFirstName(user?.displayName, user?.email);
  const initial = firstName.charAt(0).toUpperCase();

  const pillBorderStyle = { border: '0.5px solid #D1D5DB' } as const;
  const dividerStyle = { width: '0.5px', backgroundColor: '#D1D5DB' } as const;

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
      <h1 className="text-lg font-bold whitespace-nowrap">
        SPERT<sup className="text-[0.5em] text-gray-400 font-normal">®</sup> CFD
      </h1>

      {isCloudSignedIn ? (
        <div className="relative">
          <button
            ref={chipRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={popoverOpen}
            aria-label="Account menu"
            onClick={() => setPopoverOpen((o) => !o)}
            className="flex items-center rounded-full bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
              <span style={{ fontSize: 13, fontWeight: 500 }} className="text-gray-900">
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
          {popoverOpen && user && (
            <SignOutPopover
              firstName={firstName || 'Signed in'}
              email={user.email ?? ''}
              anchorRef={chipRef}
              onClose={() => setPopoverOpen(false)}
              onSignOut={signOut}
            />
          )}
        </div>
      ) : isSignedInLocal ? (
        <div className="relative">
          <button
            ref={chipRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={popoverOpen}
            aria-label="Account menu"
            onClick={() => setPopoverOpen((o) => !o)}
            className="flex items-center rounded-full bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
              <span style={{ fontSize: 13, fontWeight: 500 }} className="text-gray-900">
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
          {popoverOpen && user && (
            <SignedInLocalPopover
              firstName={firstName || 'Signed in'}
              email={user.email ?? ''}
              anchorRef={chipRef}
              onClose={() => setPopoverOpen(false)}
              onSignOut={signOut}
              onSwitchToCloudStorage={onNavigateToSettings}
            />
          )}
        </div>
      ) : (
        <button
          type="button"
          aria-label="Sign in"
          onClick={onNavigateToSettings}
          className="flex items-center rounded-full bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
    </header>
  );
}
