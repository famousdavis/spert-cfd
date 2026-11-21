// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The Projects toolbar's labelled buttons, v0.18.0 (DASH26 R1a): SPERT®
// Forecaster's `src/shared/components/toolbar-button-styles.ts` at df59b2d,
// itself GanttApp's `.pt-btn`. 35.09 px tall, 6 px corners, a 1 px grey
// outline, dark text, 14.4 px at weight 500 (600 on the primary). Every hover
// is `enabled:`-gated, so a disabled button shows none. The `dark:` values stay
// off until CFD has dark mode.

/** Box, type, corners, disabled state and the keyboard focus outline. */
export const TOOLBAR_BUTTON =
  'inline-flex items-center gap-[0.4rem] px-[0.8rem] py-[0.45rem] border rounded-[6px] text-[0.9rem] leading-[1.3] whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0070f3] dark:focus-visible:outline-[#60a5fa]';

/** Grey outline, dark text. */
export const TOOLBAR_SECONDARY =
  'font-medium bg-white text-[#333] border-[#8a8a8a] enabled:hover:bg-[#f5f5f5] dark:bg-gray-900 dark:text-[#e2e8f0] dark:border-[#8b9bb4] dark:enabled:hover:bg-[#2d3748]';

/** The one filled button of the toolbar. */
export const TOOLBAR_PRIMARY =
  'font-semibold bg-spert-blue text-white border-spert-blue enabled:hover:bg-[#005bc4] enabled:hover:border-[#005bc4]';

/** A secondary button's 18 px icon, in GanttApp's meta grey (the svg strokes in `currentColor`). */
export const TOOLBAR_ICON_SECONDARY = 'flex-none text-[#666] dark:text-[#a0aec0]';

/** The primary button's icon: the text colour. */
export const TOOLBAR_ICON_PRIMARY = 'flex-none';
