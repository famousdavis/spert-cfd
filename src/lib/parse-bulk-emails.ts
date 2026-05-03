// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Split a bulk-paste textarea into a normalized list of email
 * addresses. Accepts commas, semicolons, and any whitespace
 * (including newlines) as separators. Lowercases, trims, and
 * deduplicates while preserving the caller's original ordering.
 */
export function parseBulkEmails(raw: string): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const e = part.trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}
