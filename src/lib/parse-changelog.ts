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

/** One run of bullet text, flagged for whether it should render bold. */
export interface TextSegment {
  text: string;
  bold: boolean;
}

/**
 * Matches a backtick code span OR a `**bold**` span, in that order.
 *
 * The code-span alternative exists to be CONSUMED AND DISCARDED, not rendered:
 * it stops a doubled asterisk inside a code span from being read as a bold
 * delimiter. CHANGELOG.md already contains a doubled-asterisk glob inside
 * backticks, and without this rule a bullet mentioning such a glob BEFORE a
 * bold span would pair the glob's asterisks with the bold span's opening ones
 * and swallow everything between them. Today's single instance is safe only
 * because its bold span opens and closes first — ordering, not correctness.
 *
 * NB: that glob cannot be written literally in a block comment here, because
 * the sequence closes the comment. The same construct, twice.
 */
const SEGMENT = /(`[^`]*`)|\*\*(.+?)\*\*/g;

/**
 * Splits `**bold**` out of a bullet into renderable segments.
 *
 * Deliberately NOT a markdown renderer. It handles the one construct the
 * changelog actually uses — 139 of 406 bullets open with a bold lead-in — and
 * leaves everything else literal: single-asterisk emphasis, backticks, and
 * unmatched delimiters, all of which the page already rendered as text.
 *
 * Segment `text` values concatenate back to the input minus only the bold
 * delimiters. `parse-changelog.test.ts` asserts that over every bullet in the
 * real CHANGELOG.md.
 */
export function splitBold(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;

  for (const match of text.matchAll(SEGMENT)) {
    if (match[2] === undefined) continue; // a code span — leave it in the plain tail
    const start = match.index;
    if (start > last) segments.push({ text: text.slice(last, start), bold: false });
    segments.push({ text: match[2], bold: true });
    last = start + match[0].length;
  }

  if (last < text.length) segments.push({ text: text.slice(last), bold: false });
  return segments;
}
