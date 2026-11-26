// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The look of the shared icon buttons, v0.18.0 (DASH26 R1a): SPERT® Forecaster's
// `src/shared/components/icon-button-styles.ts` at df59b2d, itself GanttApp's.
// A 28 px box with an 18 px glyph, 6 px corners, a resting grey, and one hue per
// action on hover and on focus, with a tinted background and a 1.5 px ring.
// Every hover and focus class is `enabled:`-gated, so a disabled button shows no
// hover or focus look. The `dark:` values stay off until CFD has dark mode.

/** Box, corners, cursor, disabled state and the keyboard focus outline. */
export const ICON_BUTTON_BASE =
  'inline-flex size-7 flex-none items-center justify-center p-0 border-0 rounded-[6px] leading-[0] cursor-pointer transition-[background-color,box-shadow] duration-[120ms] ease-[ease] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0070f3] dark:focus-visible:outline-[#60a5fa]';

/** The glyph's width and height, in px. */
export const ICON_GLYPH_SIZE = 18;

/** At rest: grey, no background. */
export const ICON_REST = 'bg-transparent text-[#808080] dark:text-[#9ca3af]';

/** Delete. */
export const ICON_HUE_RED =
  'enabled:hover:text-[#ef4444] enabled:hover:bg-[#fef2f2] enabled:hover:shadow-[0_0_0_1.5px_rgba(239,68,68,0.5)] enabled:focus:text-[#ef4444] enabled:focus:bg-[#fef2f2] enabled:focus:shadow-[0_0_0_1.5px_rgba(239,68,68,0.5)] dark:enabled:hover:text-[#f87171] dark:enabled:hover:bg-[rgba(239,68,68,0.15)] dark:enabled:focus:text-[#f87171] dark:enabled:focus:bg-[rgba(239,68,68,0.15)]';

/** Export. */
export const ICON_HUE_GREEN =
  'enabled:hover:text-[#047857] enabled:hover:bg-[#ecfdf5] enabled:hover:shadow-[0_0_0_1.5px_rgba(16,185,129,0.5)] enabled:focus:text-[#047857] enabled:focus:bg-[#ecfdf5] enabled:focus:shadow-[0_0_0_1.5px_rgba(16,185,129,0.5)] dark:enabled:hover:text-[#34d399] dark:enabled:hover:bg-[rgba(16,185,129,0.15)] dark:enabled:focus:text-[#34d399] dark:enabled:focus:bg-[rgba(16,185,129,0.15)]';

/** Edit. */
export const ICON_HUE_BLUE =
  'enabled:hover:text-[#0070f3] enabled:hover:bg-[#eff6ff] enabled:hover:shadow-[0_0_0_1.5px_rgba(0,112,243,0.5)] enabled:focus:text-[#0070f3] enabled:focus:bg-[#eff6ff] enabled:focus:shadow-[0_0_0_1.5px_rgba(0,112,243,0.5)] dark:enabled:hover:text-[#60a5fa] dark:enabled:hover:bg-[rgba(0,112,243,0.15)] dark:enabled:focus:text-[#60a5fa] dark:enabled:focus:bg-[rgba(0,112,243,0.15)]';

/** Clone (v0.19.0, DASH26 R1b): Forecaster's violet, with its 1.5 px ring. */
export const ICON_HUE_VIOLET =
  'enabled:hover:text-[#7c3aed] enabled:hover:bg-[#f5f3ff] enabled:hover:shadow-[0_0_0_1.5px_rgba(139,92,246,0.5)] enabled:focus:text-[#7c3aed] enabled:focus:bg-[#f5f3ff] enabled:focus:shadow-[0_0_0_1.5px_rgba(139,92,246,0.5)] dark:enabled:hover:text-[#a78bfa] dark:enabled:hover:bg-[rgba(139,92,246,0.15)] dark:enabled:focus:text-[#a78bfa] dark:enabled:focus:bg-[rgba(139,92,246,0.15)]';

/** Share. */
export const ICON_HUE_CYAN =
  'enabled:hover:text-[#0e7490] enabled:hover:bg-[#ecfeff] enabled:hover:shadow-[0_0_0_1.5px_rgba(6,182,212,0.5)] enabled:focus:text-[#0e7490] enabled:focus:bg-[#ecfeff] enabled:focus:shadow-[0_0_0_1.5px_rgba(6,182,212,0.5)] dark:enabled:hover:text-[#22d3ee] dark:enabled:hover:bg-[rgba(6,182,212,0.15)] dark:enabled:focus:text-[#22d3ee] dark:enabled:focus:bg-[rgba(6,182,212,0.15)]';

/** Archive and Unarchive (v0.21.0, DASH26 R2): SPERT® Forecaster's slate (GanttApp's), with its 1.5 px ring. */
export const ICON_HUE_SLATE =
  'enabled:hover:text-[#475569] enabled:hover:bg-[#f1f5f9] enabled:hover:shadow-[0_0_0_1.5px_rgba(100,116,139,0.5)] enabled:focus:text-[#475569] enabled:focus:bg-[#f1f5f9] enabled:focus:shadow-[0_0_0_1.5px_rgba(100,116,139,0.5)] dark:enabled:hover:text-[#cbd5e1] dark:enabled:hover:bg-[rgba(148,163,184,0.15)] dark:enabled:focus:text-[#cbd5e1] dark:enabled:focus:bg-[rgba(148,163,184,0.15)]';
