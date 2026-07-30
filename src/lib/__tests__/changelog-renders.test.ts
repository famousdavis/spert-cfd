// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { parseChangelog, VERSION_HEADING } from '../parse-changelog';

/**
 * The changelog page renders whatever `parseChangelog` returns for the root
 * `CHANGELOG.md`. That parser is strict in two ways, and both fail silently:
 *
 *   1. A heading must match `## vX.Y.Z — Subtitle (Month D, YYYY)` exactly.
 *      Anything else is skipped by `continue` — no warning, no error.
 *   2. An entry must carry at least one `- ` bullet. A prose-only entry parses
 *      to zero items and is dropped entirely.
 *
 * Either way the entry simply never appears on the page, and nothing else can
 * tell you: the markdown is valid, `next build` succeeds, types check, lint
 * passes. Only a human opening the page and noticing an absence would catch it.
 *
 * This is not hypothetical. SPERT Forecaster shipped two entries written as
 * pure prose that rendered as empty headings for weeks before anyone looked,
 * and they were only found when a guard like this one was written. This repo
 * has the same trap with a stricter regex — a mis-typed dash or a missing date
 * parenthesis is enough to lose an entry.
 *
 * If this fails, fix the entry in `CHANGELOG.md`. Do not loosen the parser to
 * make the test pass — the page's rendering depends on that shape.
 */
describe('CHANGELOG.md renders every entry', () => {
  const markdown = readFileSync(join(process.cwd(), 'CHANGELOG.md'), 'utf-8');
  const headings = markdown.split('\n').filter((line) => line.startsWith('## '));
  const entries = parseChangelog(markdown);

  it('parses at least one entry', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('matches every version heading against the shape the page requires', () => {
    const malformed = headings.filter((line) => !VERSION_HEADING.test(line));

    expect(
      malformed,
      'these headings do not match `## vX.Y.Z — Subtitle (Month D, YYYY)` and the ' +
        `entry beneath them will never render:\n  ${malformed.join('\n  ')}`,
    ).toEqual([]);
  });

  it('renders one entry per version heading — none silently dropped', () => {
    const rendered = entries.map((e) => e.version);
    const dropped = headings
      .map((line) => line.match(VERSION_HEADING)?.[1])
      .filter((v): v is string => v !== undefined)
      .filter((v) => !rendered.includes(v));

    expect(
      dropped,
      'these versions have a valid heading but no `- ` bullet, so the parser ' +
        `discards them and they render nowhere: ${dropped.join(', ')}`,
    ).toEqual([]);

    expect(entries.length).toBe(headings.length);
  });

  it('gives every rendered entry at least one item', () => {
    const empty = entries.filter((e) => e.items.length === 0).map((e) => e.version);

    expect(empty).toEqual([]);
  });
});
