// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { splitBold } from '../parse-changelog';

/**
 * `splitBold` renders the one markdown construct the changelog actually uses.
 *
 * Before it existed the page rendered `<li>{item}</li>` on the raw string, so
 * every `**bold**` showed as literal asterisks — 139 of 406 bullets, going back
 * to the earliest entries that adopted the convention. Unit tests could not see
 * it and did not: nothing asserted on rendered output, so the defect was only
 * ever visible to someone opening the page.
 */

/** Concatenating the segments must reproduce the input minus `**` delimiters. */
const rejoin = (s: string) =>
  splitBold(s)
    .map((seg) => seg.text)
    .join('');

const stripDelimiters = (s: string) => {
  // Remove only the `**` pairs splitBold is entitled to consume: those outside
  // code spans, matched non-greedily — the same rule, expressed independently.
  let out = '';
  let last = 0;
  for (const m of s.matchAll(/(`[^`]*`)|\*\*(.+?)\*\*/g)) {
    if (m[2] === undefined) continue;
    out += s.slice(last, m.index) + m[2];
    last = m.index + m[0].length;
  }
  return out + s.slice(last);
};

describe('splitBold', () => {
  it('returns plain text as a single non-bold segment', () => {
    expect(splitBold('nothing special here')).toEqual([
      { text: 'nothing special here', bold: false },
    ]);
  });

  it('bolds a leading span and keeps the tail plain — the common changelog shape', () => {
    expect(splitBold('**Headline.** Then the explanation.')).toEqual([
      { text: 'Headline.', bold: true },
      { text: ' Then the explanation.', bold: false },
    ]);
  });

  it('handles several bold spans in one bullet', () => {
    expect(splitBold('a **one** b **two** c')).toEqual([
      { text: 'a ', bold: false },
      { text: 'one', bold: true },
      { text: ' b ', bold: false },
      { text: 'two', bold: true },
      { text: ' c', bold: false },
    ]);
  });

  it('leaves single-asterisk emphasis alone — the changelog uses it as literal text', () => {
    // e.g. "eight *packages* were affected"
    expect(splitBold('eight *packages* were affected')).toEqual([
      { text: 'eight *packages* were affected', bold: false },
    ]);
  });

  it('leaves an unmatched `**` literal rather than bolding to end of line', () => {
    expect(splitBold('an orphan ** stays put')).toEqual([
      { text: 'an orphan ** stays put', bold: false },
    ]);
  });

  it('leaves `****` literal — there is no span to bold', () => {
    expect(splitBold('before **** after')).toEqual([
      { text: 'before **** after', bold: false },
    ]);
  });

  describe('code spans shield their contents from the bold rule', () => {
    // This is the case that exists in CHANGELOG.md today.
    it('does not pair a glob inside backticks with a preceding bold span', () => {
      const live =
        '**`npm run typecheck`** — `tsconfig.json` includes `**/*.ts`, so this covers the test files.';
      expect(splitBold(live)).toEqual([
        { text: '`npm run typecheck`', bold: true },
        {
          text: ' — `tsconfig.json` includes `**/*.ts`, so this covers the test files.',
          bold: false,
        },
      ]);
    });

    // This case does NOT exist in CHANGELOG.md yet. Without the code-span rule
    // the glob's `**` would pair with the bold's opening `**` and swallow
    // everything between them. Today's live line is safe only because its bold
    // span happens to open and close before the glob appears.
    it('survives a glob that appears BEFORE a bold span', () => {
      const reversed = '`**/*.ts` is covered by **typecheck** now';
      expect(splitBold(reversed)).toEqual([
        { text: '`**/*.ts` is covered by ', bold: false },
        { text: 'typecheck', bold: true },
        { text: ' now', bold: false },
      ]);
    });
  });

  it('loses no characters other than the `**` delimiters', () => {
    for (const sample of [
      '**a** b',
      'b **a**',
      '`**/*.ts` and **bold**',
      'plain',
      '**one****two**',
    ]) {
      expect(rejoin(sample), sample).toBe(stripDelimiters(sample));
    }
  });
});

describe('splitBold over the real CHANGELOG.md', () => {
  const bullets = readFileSync(join(process.cwd(), 'CHANGELOG.md'), 'utf-8')
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());

  it('has bullets to check', () => {
    expect(bullets.length).toBeGreaterThan(100);
  });

  it('never drops or duplicates text on any real bullet', () => {
    const damaged = bullets.filter((b) => rejoin(b) !== stripDelimiters(b));

    expect(
      damaged,
      `these bullets do not survive splitBold intact:\n  ${damaged.join('\n  ')}`,
    ).toEqual([]);
  });

  it('actually finds bold spans — a transform that matched nothing would pass the test above', () => {
    const withBold = bullets.filter((b) => splitBold(b).some((seg) => seg.bold));

    expect(withBold.length).toBeGreaterThan(100);
  });

  it('emits no empty bold segment', () => {
    const empty = bullets.filter((b) =>
      splitBold(b).some((seg) => seg.bold && seg.text.length === 0),
    );

    expect(empty).toEqual([]);
  });
});
