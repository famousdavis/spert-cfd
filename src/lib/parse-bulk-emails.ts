// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Same shape used by the suite's server-side EMAIL_RE — kept in sync so a
// token rejected here is also rejected by the Cloud Function. Catches the
// majority of obvious typos (no '@', missing TLD) without trying to be a
// full RFC 5322 implementation, which is intractable client-side.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Split a bulk-paste textarea into deduplicated, lowercased, trimmed
 * email addresses, partitioned by EMAIL_RE validity. Accepts commas,
 * semicolons, and any whitespace (including newlines) as separators.
 *
 * Returns BOTH arrays — never `string[]` alone. Callers need invalid
 * tokens to render "invalid-format" feedback chips and to gate textarea
 * clearing (Lessons 42, 43): silently dropping malformed entries looks
 * like the app ate user input. Dedup is case-insensitive and preserves
 * original ordering on the first occurrence.
 */
export function parseBulkEmails(raw: string): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];
  if (!raw) return { valid, invalid };

  const seen = new Set<string>();
  for (const part of raw.split(/[,;\s]+/)) {
    const e = part.trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    if (EMAIL_RE.test(e)) {
      valid.push(e);
    } else {
      invalid.push(e);
    }
  }
  return { valid, invalid };
}
