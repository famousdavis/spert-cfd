// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import {
  LS_TOS_ACCEPTED_VERSION,
  LS_TOS_WRITE_PENDING,
  TOS_VERSION,
} from './constants';

/** Check if user has accepted the current ToS version */
export function hasAcceptedCurrentTos(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(LS_TOS_ACCEPTED_VERSION) === TOS_VERSION;
}

/** Record local ToS acceptance */
export function recordLocalAcceptance(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_TOS_ACCEPTED_VERSION, TOS_VERSION);
}

/** Set the write-pending flag before Firebase Auth fires */
export function setWritePending(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_TOS_WRITE_PENDING, 'true');
}

/** Check and clear the write-pending flag */
export function consumeWritePending(): boolean {
  if (typeof window === 'undefined') return false;
  const pending = localStorage.getItem(LS_TOS_WRITE_PENDING) === 'true';
  if (pending) localStorage.removeItem(LS_TOS_WRITE_PENDING);
  return pending;
}

/** Clear all local consent state */
export function clearLocalConsent(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LS_TOS_ACCEPTED_VERSION);
  localStorage.removeItem(LS_TOS_WRITE_PENDING);
}
