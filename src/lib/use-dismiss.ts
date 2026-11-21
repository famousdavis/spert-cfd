// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Close a modal dialog on Escape, and only it (v0.18.0, DASH26 R1a).
 *
 * ONE `document` keydown listener in the CAPTURE phase, which calls
 * `preventDefault` and `stopPropagation`: every `useEscapeKey` below listens on
 * `document` in the bubble phase, and a stop in the capture phase keeps the
 * Escape from reaching them. Without it, one Escape in a dialog opened over the
 * Projects tab's import preview closed the dialog AND discarded the import
 * (measured live at 0faa31a; the capture listener measured to stop it). Not a
 * React `onKeyDown` with `stopPropagation`: Next hydrates `document` itself, so
 * a React stop does not stop another listener on `document` (SPERT®
 * Forecaster's `ProjectDialog.tsx` at df59b2d).
 */
export function useModalEscape(onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      closeRef.current();
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, []);
}

/** Close a popover/modal on Escape key press (bubble phase; for a surface never stacked over another Escape listener) */
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
