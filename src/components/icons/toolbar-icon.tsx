// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * One dashboard-toolbar icon, hidden from assistive tech (the button's label
 * names it). Its path strokes in `currentColor`, so `className` sets its
 * colour. v0.18.0: 18 px, as SPERT® Forecaster's (`ToolbarIcon.tsx` at
 * df59b2d); the paths are unchanged.
 */
export function ToolbarIcon({ d, size = 18, className }: { d: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <path d={d} stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
