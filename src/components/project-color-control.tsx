// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

// The Tile color button and its popover (v0.21.0, DASH26 R2, O50): SPERT®
// Forecaster's `ProjectColorControl.tsx` at df59b2d (itself GanttApp's).
//
// Two components, because of where the popover must sit. The button lives in
// the tile's revealed row, which is `relative z-[1]` (ABOVE_OPEN) to sit above
// the name button's `::after`. A popover inside that row would take the row as
// its containing block and paint at the row's level, under the next tile's
// controls; the tile renders the popover beside the row instead, so its
// containing block is the tile and its `z-20` sits with every tile's `z-[1]`.
//
// ⚠️ Escape goes through `useModalEscape` (O57), not the popover's own
// keydown: CFD's import preview listens with a bubble-phase `useEscapeKey`
// that does not skip a handled Escape, and Next hydrates `document`, so a
// React `stopPropagation` does not stop it (`use-dismiss.ts`). The capture
// listener closes only the newest open surface, so one Escape closes this
// popover and leaves a waiting import, or a dialog under it, alone.

import { useEffect, useId, useRef, type RefObject } from 'react';
import { useModalEscape } from '@/lib/use-dismiss';
import { PROJECT_COLORS, type ProjectColor } from '@/lib/project-prefs';
import { COLOR_BUTTON, COLOR_DOT, NONE_DOT, POPOVER, POP_HINT, POP_TITLE, SWATCHES, SWATCH_BG, SW, SW_DOT, SW_NONE, SW_RADIO } from './tile-color-styles';

type ColorChoice = ProjectColor | 'none';
const CHOICES: readonly ColorChoice[] = [...PROJECT_COLORS, 'none'];

export const CHOICE_LABELS: Record<ColorChoice, string> = {
  blue: 'Blue',
  teal: 'Teal',
  slate: 'Slate',
  purple: 'Purple',
  pink: 'Pink',
  none: 'No color',
};

const choiceOf = (color: ProjectColor | undefined): ColorChoice => color ?? 'none';

interface ProjectColorButtonProps {
  projectName: string;
  color: ProjectColor | undefined;
  open: boolean;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onOpenChange: (open: boolean) => void;
  /** Why the colour cannot be changed now (O54, O60), or null. */
  disabledReason: string | null;
  /** The id of the element that says why (aria-describedby). */
  describedBy?: string;
}

/** The Tile color button, named with the project: "Tile color for Alpha: Blue". */
export function ProjectColorButton({ projectName, color, open, buttonRef, onOpenChange, disabledReason, describedBy }: ProjectColorButtonProps) {
  const choice = choiceOf(color);
  return (
    <button
      ref={buttonRef}
      type="button"
      className={COLOR_BUTTON}
      aria-label={`Tile color for ${projectName}: ${CHOICE_LABELS[choice]}`}
      title={disabledReason ?? 'Tile color'}
      aria-haspopup="dialog"
      aria-expanded={open}
      disabled={disabledReason !== null}
      aria-describedby={describedBy}
      // While open, a press here must not move focus: the blur would close the
      // popover and the click would open it again.
      onMouseDown={(e) => {
        if (open) e.preventDefault();
      }}
      onClick={() => {
        if (open) {
          onOpenChange(false);
          buttonRef.current?.focus();
        } else {
          onOpenChange(true);
        }
      }}
    >
      <span className={`${COLOR_DOT} ${choice === 'none' ? NONE_DOT : SWATCH_BG[choice]}`} aria-hidden="true" />
    </button>
  );
}

interface ProjectColorPopoverProps {
  color: ProjectColor | undefined;
  /** The Tile color button: a press on it is not a press outside, and focus returns to it. */
  buttonRef: RefObject<HTMLButtonElement | null>;
  /** Applies a pick; false means it was refused and nothing changed. */
  onPick: (color: ProjectColor | null) => boolean;
  onOpenChange: (open: boolean) => void;
}

/** The popover: six native radios in one group, under a title, with a hint. Not a modal surface. */
export function ProjectColorPopover({ color, buttonRef, onPick, onOpenChange }: ProjectColorPopoverProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const rootRef = useRef<HTMLDivElement>(null);
  const choice = choiceOf(color);
  // Set by a press on a choice and cleared by any key: an arrow key's change
  // comes with a click too, and only a mouse or touch pick closes the popover.
  const pickByPointerRef = useRef(false);
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  const close = (returnFocus: boolean) => {
    onOpenChange(false);
    if (returnFocus) buttonRef.current?.focus();
  };
  // O57: Escape closes this popover only, focus back on its button.
  useModalEscape(() => close(true));

  useEffect(() => {
    // Focus the checked colour without scrolling, then bring the whole popover
    // into view: on the last row it opens past the scroll area's bottom edge,
    // above the pinned footer (measured), and would otherwise be cut there.
    rootRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus({ preventScroll: true });
    rootRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  useEffect(() => {
    // Capture phase: a press anywhere outside the popover and its button
    // closes it, before the press does whatever else it does.
    const closeOnOutsidePress = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      onOpenChangeRef.current(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress, true);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress, true);
  }, [buttonRef]);

  const finishPointerPick = () => {
    if (!pickByPointerRef.current) return;
    pickByPointerRef.current = false;
    close(true);
  };

  const pick = (next: ColorChoice) => {
    if (onPick(next === 'none' ? null : next)) {
      finishPointerPick();
      return;
    }
    // Refused: React puts the checked radio back, and focus goes back with
    // it. The value is one of the six fixed choices, never a name or an id.
    rootRef.current?.querySelector<HTMLInputElement>(`input[value="${choice}"]`)?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={POPOVER}
      role="dialog"
      aria-label="Tile color"
      onPointerDown={(e) => {
        pickByPointerRef.current = (e.target as Element).closest('label') !== null;
      }}
      onMouseDown={(e) => {
        // A press on a label or the text must not take focus out of the
        // popover, which would close it before the click.
        if (!(e.target as Element).matches('input')) e.preventDefault();
      }}
      onKeyDown={(e) => {
        pickByPointerRef.current = false;
        if (e.key !== 'Enter') return;
        e.preventDefault();
        close(true);
      }}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        // No next element: the window lost focus, or a press outside, which closes it by itself.
        if (next && !e.currentTarget.contains(next)) onOpenChange(false);
      }}
    >
      <p className={POP_TITLE} id={titleId}>
        Tile color
      </p>
      <div className={SWATCHES} role="radiogroup" aria-labelledby={titleId}>
        {CHOICES.map((value) => {
          const radioId = `${baseId}-${value}`;
          return (
            <label key={value} className={SW} htmlFor={radioId}>
              <input
                type="radio"
                className={SW_RADIO}
                id={radioId}
                name={`tile-color-${baseId}`}
                value={value}
                checked={choice === value}
                onChange={() => pick(value)}
                // Picking the colour already chosen changes nothing, but a mouse pick still closes.
                onClick={() => {
                  if (choice === value) finishPointerPick();
                }}
              />
              <span className={`${SW_DOT} ${value === 'none' ? SW_NONE : SWATCH_BG[value]}`} data-c={value} aria-hidden="true" />
              {CHOICE_LABELS[value]}
            </label>
          );
        })}
      </div>
      <p className={POP_HINT}>Arrow keys choose. Enter or Esc closes.</p>
    </div>
  );
}
