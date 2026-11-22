// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useSyncExternalStore } from 'react';
import {
  choosePreference,
  getPreference,
  subscribe,
  systemIsDark,
  type ThemePreference,
} from '@/lib/theme';

/*
 * The header's theme switch (v0.20.0, DASH26 RD2): SPERT® Forecaster's
 * `HeaderThemeToggle` (ThemeToggle.tsx at df59b2d) — its coloured icons, its
 * order System → Light → Dark → System (R33), its `aria-label` and `title` —
 * with CFD's store behind it (theme.ts). Additions: full opacity while focused
 * (O39), `type="button"`, and a polite status line that says what each click
 * chose (O38). The only theme control (R30) and the only writer of the
 * preference.
 */

const THEME_LABELS: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

// Next theme in the cycle: light → dark → system → light
const NEXT_THEME: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

// The icons and their colours are Forecaster's, kept under 3:1 at rest by
// decision (O37: the sun and the monitor on white are suite shortfalls).
function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#eab308" stroke="#ca8a04" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" fill="#e5e7eb" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

const CURRENT_THEME_ICON: Record<ThemePreference, () => React.JSX.Element> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
};

/**
 * Before the preference is known: only the server's render, which `/` never
 * makes (the header mounts after the loading screen, on the client), so it is
 * not seen there. CFD's own grey, with its dark partner (Forecaster's
 * `bg-muted` compiles to nothing in CFD).
 */
const getServerPreference = () => null;

/** Compact icon button for the app header. Shows the current theme's icon. */
export function HeaderThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getPreference, getServerPreference);
  const [announcement, setAnnouncement] = useState('');

  // Always mounted with the switch, so the first click's words are announced.
  const status = (
    <span role="status" aria-live="polite" className="sr-only">
      {announcement}
    </span>
  );

  if (theme === null) {
    return (
      <>
        <div className="h-8 w-8 rounded bg-gray-200 dark:bg-gray-700" />
        {status}
      </>
    );
  }

  const nextTheme = NEXT_THEME[theme];
  const Icon = CURRENT_THEME_ICON[theme];

  const choose = () => {
    choosePreference(nextTheme);
    setAnnouncement(
      nextTheme === 'system'
        ? `Theme: System (${systemIsDark() ? 'dark' : 'light'})`
        : `Theme: ${THEME_LABELS[nextTheme]}`,
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={choose}
        className="p-1.5 rounded transition-opacity opacity-70 hover:opacity-100 focus-visible:opacity-100 cursor-pointer"
        aria-label={`Theme: ${THEME_LABELS[theme]}. Switch to ${THEME_LABELS[nextTheme]}`}
        title={`Theme: ${THEME_LABELS[theme]}`}
      >
        <Icon />
      </button>
      {status}
    </>
  );
}
