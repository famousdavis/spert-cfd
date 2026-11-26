// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

/**
 * The tile's six-dot grip, v0.18.0 (DASH26 R1a): SPERT® Forecaster's
 * `src/shared/components/DragHandle.tsx` at df59b2d — four-pixel dots, two
 * columns, 2 px apart, Tailwind's gray-400 (gray-500 in the dark theme).
 * Decorative: hidden from assistive tech, as the siblings'.
 *
 * v0.21.0 (DASH26 R2, O66): on a coloured tile (a tint or an archived tint) the
 * dark grip is gray-400, since gray-500 measures under 3:1 on every dark tint
 * (2.23–2.60:1 from hex); the untinted tile is unchanged. In light the grip is
 * Forecaster's on every tile, a suite shortfall (DASH26 §7 answer 6).
 */
export function DragHandle({ tinted = false }: { tinted?: boolean }) {
  const dot = tinted ? DOT_TINTED : DOT;
  return (
    <div aria-hidden="true" className="grid grid-cols-2 gap-[2px] cursor-grab active:cursor-grabbing">
      <div className={dot} />
      <div className={dot} />
      <div className={dot} />
      <div className={dot} />
      <div className={dot} />
      <div className={dot} />
    </div>
  );
}

const DOT = 'w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500';
const DOT_TINTED = 'w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-400';
