// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * A local save refused because the browser's storage is full (v0.19.0,
 * DASH26 R25 and O24): Clone, Create, Load Sample and the CFD tab's edits say
 * so in these words.
 */
export const STORAGE_FULL_MESSAGE =
  "This browser's storage is full. Export a project, then delete one to make room.";

// Chrome, Edge and Safari report `QuotaExceededError` (legacy code 22); older
// Firefox `NS_ERROR_DOM_QUOTA_REACHED` (code 1014).
const QUOTA_NAMES: ReadonlySet<string> = new Set(['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED']);
const QUOTA_CODES: ReadonlySet<number> = new Set([22, 1014]);

/**
 * True for a storage quota error, by its name or its numeric code.
 *
 * ⚠️ Never `instanceof DOMException`: an error thrown by another realm's
 * storage is a DOMException of THAT realm. Measured: jsdom's quota error
 * (name QuotaExceededError, code 22) is not an instance of Node's global
 * DOMException. A Firestore error's `code` is a string and never matches.
 */
export function isStorageFullError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const { name, code } = err as { name?: unknown; code?: unknown };
  return (typeof name === 'string' && QUOTA_NAMES.has(name)) || (typeof code === 'number' && QUOTA_CODES.has(code));
}
