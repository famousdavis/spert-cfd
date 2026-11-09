// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The page's one column: the header, the tabs, the app notices and
 * every tab's content share it, so their edges line up — the layout of
 * GanttApp and SPERT® Forecaster (1200px, 2rem gutters from `md`).
 *
 * A scrolling view puts this inside its scroll container, not on it, so the
 * scrollbar stays at the window's edge.
 */
export const PAGE_COLUMN = 'mx-auto w-full max-w-[1200px] px-4 md:px-8';
