// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

// ProjectDialog — the one New Project / Edit Project dialog (v0.18.0, DASH26
// R1a): SPERT® Forecaster's `src/features/projects/components/ProjectDialog.tsx`
// at df59b2d, itself GanttApp's, around CFD's one field, the project's name
// (DASH26 O4). It replaces v0.17.0's New Project dialog and the tile's inline
// rename.
// - Rendered into document.body; while it is open every other child of body is
//   `inert`, so the page behind can be neither reached nor read, and only what
//   this dialog made inert is restored when it closes.
// - Focus opens on Project Name (its text selected for Edit); Tab and
//   Shift+Tab wrap at the dialog's ends, and bring focus back if it has left.
// - Escape closes it, and focus goes back where the caller says, after
//   `inert` is removed.
//
// ⚠️ Escape is handled by `useModalEscape` (`use-dismiss.ts`): ONE document
// keydown listener in the CAPTURE phase, shared by every open modal, which
// closes only the innermost and calls preventDefault and stopPropagation. The
// import preview's own Escape listens on `document` in the bubble phase, and
// without the stop one Escape here closed the dialog AND discarded a waiting
// import (measured).
//
// ⚠️ Focus returns in the close cleanup, after `inert` is removed. Focusing
// from a submit or cancel handler is a silent no-op in a browser: the page is
// still inert then (Forecaster, measured; jsdom does not enforce `inert`, so a
// test there passes either way).

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { MAX_NAME_LENGTH } from '@/lib/constants';
import { useModalEscape } from '@/lib/use-dismiss';
import { useScrollLock } from '@/lib/use-scroll-lock';
import {
  DIALOG,
  DIALOG_BG,
  DIALOG_BUTTONS,
  DIALOG_CANCEL,
  DIALOG_SUBMIT,
  DIALOG_TITLE,
  FIELD,
  INPUT,
  LABEL,
  OVERLAY,
} from './dashboard-styles';

interface ProjectDialogProps {
  /**
   * Which dialog this is: 'new', or the id of the project being edited.
   * Opening (inert, first focus) and closing (restore, return focus) run once
   * per identity, never on a re-render.
   */
  identity: string;
  title: string;
  /** The name the field starts with: '' for New, the project's for Edit. */
  initialName: string;
  /** 'Create' or 'Update'. */
  submitLabel: string;
  /** Called with the trimmed, non-blank name. */
  onSubmit: (name: string) => void;
  /** Escape and Cancel. */
  onCancel: () => void;
  /** Where focus goes once the dialog has closed; null for nowhere. Read at close time. */
  returnFocusTo: () => HTMLElement | null;
}

const FOCUSABLE = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])';

/** Make every other child of body inert; returns the undo, which restores only what it changed. */
function inertOthers(keep: HTMLElement): () => void {
  const changed = Array.from(document.body.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el !== keep && !el.hasAttribute('inert'),
  );
  changed.forEach((el) => el.setAttribute('inert', ''));
  return () => changed.forEach((el) => el.removeAttribute('inert'));
}

/** Tab and Shift+Tab wrap at the dialog's ends; from outside it, they bring focus back in. */
function wrapTab(e: KeyboardEvent, root: HTMLElement) {
  const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const inside = active instanceof HTMLElement && root.contains(active);
  if (e.shiftKey && (active === first || !inside)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (active === last || !inside)) {
    e.preventDefault();
    first.focus();
  }
}

export function ProjectDialog({
  identity,
  title,
  initialName,
  submitLabel,
  onSubmit,
  onCancel,
  returnFocusTo,
}: ProjectDialogProps) {
  const titleId = useId();
  const nameId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  // The latest callbacks, read by the listener and the cleanup when they run.
  const cancelRef = useRef(onCancel);
  const returnFocusRef = useRef(returnFocusTo);
  useEffect(() => {
    cancelRef.current = onCancel;
    returnFocusRef.current = returnFocusTo;
  });

  // Open: the page inert, focus to Project Name. Close: inert removed, THEN focus back.
  useEffect(() => {
    const overlay = overlayRef.current;
    const undoInert = overlay ? inertOthers(overlay) : () => {};
    inputRef.current?.focus();
    if (identity !== 'new') inputRef.current?.select();
    return () => {
      undoInert();
      returnFocusRef.current()?.focus();
    };
  }, [identity]);

  // Escape: the shared capture-phase listener for modals, which closes only
  // the innermost one and stops the key there (use-dismiss.ts).
  useModalEscape(() => cancelRef.current());
  useScrollLock();

  // Tab, in the capture phase, registered once. Removed with the same flag.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const root = dialogRef.current;
      if (!root) return;
      if (e.key === 'Tab') wrapTab(e, root);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return createPortal(
    <div ref={overlayRef} className={OVERLAY}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`${DIALOG} ${DIALOG_BG}`}>
        <h3 id={titleId} className={DIALOG_TITLE}>
          {title}
        </h3>
        <form onSubmit={handleSubmit}>
          <div className={FIELD}>
            <label htmlFor={nameId} className={LABEL}>
              Project Name
            </label>
            {/* App-domain text, not the user's own name: no autofill. */}
            <input
              ref={inputRef}
              id={nameId}
              name="projectName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="off"
              className={INPUT}
            />
          </div>
          <div className={DIALOG_BUTTONS}>
            <button type="button" onClick={onCancel} className={DIALOG_CANCEL}>
              Cancel
            </button>
            <button type="submit" disabled={!trimmed} className={DIALOG_SUBMIT}>
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
