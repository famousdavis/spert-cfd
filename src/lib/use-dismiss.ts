// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { useEffect, useRef, type RefObject } from 'react';

/**
 * The open modals that close on Escape, innermost last (v0.18.0, DASH26 R1a).
 * ONE `document` keydown listener in the CAPTURE phase serves them all while
 * any is open: it closes ONLY the innermost, and calls `preventDefault` and
 * `stopPropagation`, so the Escape reaches no other modal and no bubble-phase
 * `useEscapeKey` below (the Projects tab's import preview listens that way).
 *
 * Why one listener and a stack, not one capture listener per modal: two
 * listeners on the same node in the same phase both run whatever the first one
 * does (`stopPropagation` stops only the other nodes), so a confirmation inside
 * the sharing window, or the consent window over the Cloud Storage window,
 * would close both on one Escape. A modal opened later is pushed later, so the
 * last entry is the one on top.
 *
 * Why the capture phase at all: without it, one Escape in a dialog opened over
 * the Projects tab's import preview closed the dialog AND discarded the import
 * (measured live at 0faa31a, for the New Project dialog and the Cloud Storage
 * window). Not a React `onKeyDown` with `stopPropagation`: Next hydrates
 * `document` itself, so a React stop does not stop another listener on
 * `document` (SPERT® Forecaster's `ProjectDialog.tsx` at df59b2d).
 */
const openModals: Array<{ current: () => void }> = [];

function closeInnermostModal(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  const innermost = openModals[openModals.length - 1];
  if (!innermost) return;
  e.preventDefault();
  e.stopPropagation();
  innermost.current();
}

/**
 * Close a modal dialog on Escape, and only it (see `openModals`). `active`
 * false leaves the modal out of the stack, for a modal that stays mounted while
 * closed (the Cloud Storage window): a closed modal must not swallow Escape.
 */
export function useModalEscape(onClose: () => void, active = true) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!active) return;
    const entry = closeRef;
    openModals.push(entry);
    if (openModals.length === 1) document.addEventListener('keydown', closeInnermostModal, true);
    return () => {
      const i = openModals.lastIndexOf(entry);
      if (i !== -1) openModals.splice(i, 1);
      if (openModals.length === 0) document.removeEventListener('keydown', closeInnermostModal, true);
    };
  }, [active]);
}

/**
 * Close a popover or panel on Escape (bubble phase). A modal that can open over
 * another Escape-listening surface uses `useModalEscape` instead: this one is
 * stopped by an open modal's capture-phase listener, as it should be.
 */
export function useEscapeKey(onClose: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
}

/** Close a popover when clicking outside the referenced element */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose]);
}
