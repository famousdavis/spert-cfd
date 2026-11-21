// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

// The tile's icon buttons, v0.18.0 (DASH26 R1a): SPERT® Forecaster's
// `TrashIconButton`, `ExportIconButton`, `PencilIconButton` and
// `ShareIconButton` (`src/shared/components/` at df59b2d). Each svg's children
// are copied whole from those files, attributes included, and
// `icon-buttons.test.tsx` holds them to that copy. A disabled button carries its
// reason in `title` and, through `describedBy`, in screen-reader text.

import type { ReactNode } from 'react';
import {
  ICON_BUTTON_BASE,
  ICON_GLYPH_SIZE,
  ICON_REST,
  ICON_HUE_RED,
  ICON_HUE_GREEN,
  ICON_HUE_BLUE,
  ICON_HUE_CYAN,
} from './icon-button-styles';

export interface IconButtonProps {
  onClick: () => void;
  ariaLabel: string;
  title: string;
  disabled?: boolean;
  /** The id of an element that says why the button is disabled (aria-describedby). */
  describedBy?: string;
}

function IconButton({ hue, children, onClick, ariaLabel, title, disabled = false, describedBy }: IconButtonProps & { hue: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      aria-describedby={describedBy}
      className={`${ICON_BUTTON_BASE} ${ICON_REST} ${hue}`}
    >
      {children}
    </button>
  );
}

/** One stroked path in a 24-unit box: Trash, Export and Pencil. */
function PathGlyph({ d }: { d: string }) {
  return (
    <svg
      width={ICON_GLYPH_SIZE}
      height={ICON_GLYPH_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d={d} stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const TRASH_PATH = 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6';
export const EXPORT_PATH = 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3';
export const PENCIL_PATH = 'M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z';

export function TrashIconButton(props: IconButtonProps) {
  return (
    <IconButton hue={ICON_HUE_RED} {...props}>
      <PathGlyph d={TRASH_PATH} />
    </IconButton>
  );
}

export function ExportIconButton(props: IconButtonProps) {
  return (
    <IconButton hue={ICON_HUE_GREEN} {...props}>
      <PathGlyph d={EXPORT_PATH} />
    </IconButton>
  );
}

export function PencilIconButton(props: IconButtonProps) {
  return (
    <IconButton hue={ICON_HUE_BLUE} {...props}>
      <PathGlyph d={PENCIL_PATH} />
    </IconButton>
  );
}

export function ShareIconButton(props: IconButtonProps) {
  return (
    <IconButton hue={ICON_HUE_CYAN} {...props}>
      <svg
        width={ICON_GLYPH_SIZE}
        height={ICON_GLYPH_SIZE}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    </IconButton>
  );
}
