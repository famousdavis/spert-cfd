// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

/**
 * The tile's six-dot grip, v0.18.0 (DASH26 R1a): SPERT® Forecaster's
 * `src/shared/components/DragHandle.tsx` at df59b2d — four-pixel dots, two
 * columns, 2 px apart, Tailwind's gray-400 (gray-500 in the dark theme, off
 * until CFD has one). Decorative: hidden from assistive tech, as the siblings'.
 */
export function DragHandle() {
  return (
    <div aria-hidden="true" className="grid grid-cols-2 gap-[2px] cursor-grab active:cursor-grabbing">
      <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500" />
      <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500" />
      <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500" />
      <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500" />
      <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500" />
      <div className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500" />
    </div>
  );
}
