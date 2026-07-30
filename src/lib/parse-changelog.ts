// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Parses CHANGELOG.md into structured entries for the changelog page.
// CHANGELOG.md is the single source of truth — there is no hardcoded array.
//
// Extracted from src/app/changelog/page.tsx in v0.14.11 so it can be tested
// directly. The parser is strict and FAILS SILENTLY: an entry whose heading
// does not match the expected shape, or which carries no `- ` bullet, is
// skipped by `continue` with no warning and simply never appears on the page.
// Nothing else would notice — the markdown stays valid, the build succeeds,
// types check and lint passes.
//
// SPERT Forecaster shipped exactly that failure: two entries written as pure
// prose parsed to nothing and rendered as empty headings for weeks.
// `src/lib/__tests__/changelog-renders.test.ts` is what holds this repo to it.

export interface ChangelogEntry {
  version: string;
  subtitle: string;
  date: string;
  items: string[];
}

/** The heading shape the page requires: `## vX.Y.Z — Subtitle (Month D, YYYY)`. */
export const VERSION_HEADING = /^## (v[\d.]+)\s*[—–-]\s*(.+?)\s*\(([^)]+)\)$/;

export function parseChangelog(content: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];

  for (const section of content.split(/\n(?=## )/)) {
    const lines = section.trim().split('\n');
    const match = lines[0].match(VERSION_HEADING);
    if (!match) continue;

    const [, version, subtitle, date] = match;
    const items = lines
      .slice(1)
      .filter((line) => line.startsWith('- '))
      .map((line) => line.slice(2).trim());

    if (items.length > 0) {
      entries.push({ version, subtitle, date, items });
    }
  }

  return entries;
}
