// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Reorder a "Last, First Middle [Suffix]" name (the Microsoft AD
 * displayName convention) into "First Middle Last" form. Names
 * without a comma are returned unchanged.
 *
 * Mirrored from spert-landing-page/functions/src/mailHeaders.ts so
 * the client can pre-normalize displayName at write time before it
 * lands in spertsuite_profiles. The Cloud Function also normalizes
 * defensively, but doing it client-side avoids the legacy data
 * problem documented in the multi-app generalization PR.
 *
 * Examples:
 *   "Davis, William W"   → "William W Davis"
 *   "Smith, John, Jr."   → "John Jr. Smith"
 *   "Cher"               → "Cher"
 *   ""                   → ""
 */
export function denormalizeLastFirst(s: string): string {
  const parts = s.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length < 2) return s.trim();
  const [last, ...rest] = parts;
  return `${rest.join(' ')} ${last}`;
}
