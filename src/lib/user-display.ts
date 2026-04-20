// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Extract a display-friendly first name from a Firebase displayName.
 *
 * Handles two formats:
 *   - "First Last" (Google, typical Microsoft personal): take first token.
 *   - "Last, First" (Microsoft Entra ID corporate): take first token
 *     after the comma.
 *
 * Falls back to email (then empty string) when displayName is missing or
 * yields an empty result.
 */
export function getFirstName(
  displayName: string | null | undefined,
  email: string | null | undefined,
): string {
  const raw = displayName ?? '';
  if (raw.includes(',')) {
    const afterComma = raw.split(',')[1]?.trim() ?? '';
    const firstToken = afterComma.split(/\s+/)[0] ?? '';
    return firstToken || email || '';
  }
  const firstToken = raw.trim().split(/\s+/)[0] ?? '';
  return firstToken || email || '';
}
