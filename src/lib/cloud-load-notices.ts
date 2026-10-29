// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The projects in which a cloud-load check set something aside (v0.16.4).
 *
 * Module-level, like the reset registry it joins: the Firestore driver
 * reports into it, `CloudLoadNoticeBanner` reads it, and a sign-out clears it
 * (through `runDataReset`), so a notice never outlives the account it was for.
 */

import type { CloudSetAsideRule } from './cloud-load-guards';
import { registerDataReset } from './app-data-reset-registry';

const EMPTY: readonly string[] = [];

let shown: readonly string[] = EMPTY;
const dismissed = new Set<string>();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Note a value set aside: a console line naming the rule (never the value), and the project's notice. */
export function noteCloudSetAside(projectId: string, rule: CloudSetAsideRule): void {
  console.warn(`[SPERT CFD] cloud-load-guard: ${rule}`);
  if (dismissed.has(projectId) || shown.includes(projectId)) return;
  shown = [...shown, projectId];
  emit();
}

/** The projects to name in the notice, in the order first reported. */
export function getCloudSetAsideProjects(): readonly string[] {
  return shown;
}

/** For the server render, where nothing has loaded. */
export function getNoCloudSetAsideProjects(): readonly string[] {
  return EMPTY;
}

export function subscribeCloudSetAsideNotices(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The user closed the notice: these projects are not named again this session. */
export function dismissCloudSetAsideNotices(): void {
  shown.forEach((projectId) => dismissed.add(projectId));
  shown = EMPTY;
  emit();
}

/** Forget every notice, dismissed ones included. Runs at sign-out. */
export function clearCloudSetAsideNotices(): void {
  dismissed.clear();
  shown = EMPTY;
  emit();
}

registerDataReset(clearCloudSetAsideNotices);
