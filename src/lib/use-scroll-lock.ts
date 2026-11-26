// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useEffect } from 'react';

// v0.23.0 (FRAME26 clean-up C8): since v0.22.0 Projects, Settings, About and
// the changelog scroll the document, and a wheel over a dialog's overlay
// scrolled the page behind it (0 → 122 measured at 1280 × 300 with the Delete
// confirmation open). Every fixed-overlay dialog takes this lock while it is
// open. One count for the page: a dialog over another (consent over Cloud
// Storage) releases only its own hold, and the page unlocks with the last one.
//
// `overflow: hidden` on <body> propagates to the viewport while <html> is
// `visible` (it is), so the wheel and the keyboard stop scrolling the page and
// its position stays where it was. The root's `scrollbar-gutter: stable` (the
// frame) keeps the column still with classic scrollbars. A script's
// `scrollTo` still moves it (measured in Forecaster, FRAME26 stage 2); nothing
// here scrolls from script while a dialog is open.

let holds = 0;
let previous = '';

function hold(): void {
  if (holds === 0) {
    previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  holds++;
}

function release(): void {
  holds = Math.max(0, holds - 1);
  if (holds === 0) document.body.style.overflow = previous;
}

/** Keeps the page from scrolling behind a dialog while `active` (by default, while mounted). */
export function useScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;
    hold();
    return release;
  }, [active]);
}

/** Tests only: the number of holds now. */
export function scrollLockHolds(): number {
  return holds;
}
