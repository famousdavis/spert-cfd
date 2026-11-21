// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

/**
 * Two lines of `src/app/globals.css` that nothing else would miss (v0.17.9).
 * Lint, typecheck, the other tests and `next build` all pass without either:
 *
 * - The SPERT® blues. Without the `@theme` block, `from-spert-blue-light`,
 *   `to-spert-blue-dark`, `bg-spert-blue` and `border-b-spert-blue` compile to
 *   nothing: the header's title renders as transparent text on no background,
 *   and the open tab's white label on no fill. Both invisible. The block must be
 *   a plain `@theme`, not `@theme inline`, so the utilities read the variables
 *   and a later dark value can override them.
 * - The class-based dark variant. Without it, Tailwind 4's `dark:` follows the
 *   operating system, and the app turns partly dark for anyone whose computer is
 *   set to dark, before CFD has a dark mode.
 *
 * Comments are stripped first, so a comment quoting a line cannot satisfy it.
 */
const css = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  ''
);

describe('globals.css', () => {
  it('declares the dark variant on a .dark ancestor, not on the OS setting', () => {
    const lines = css.split('\n').map((l) => l.trim());
    expect(lines).toContain('@custom-variant dark (&:is(.dark *));');
  });

  it('defines the three SPERT® blues in a plain @theme block', () => {
    const blocks = [...css.matchAll(/@theme(\s+inline)?\s*\{([^}]*)\}/g)];
    const withBlues = blocks.filter((b) => b[2].includes('--color-spert-blue'));
    expect(withBlues, 'one @theme block holds the spert blues').toHaveLength(1);
    const [, inline, body] = withBlues[0];
    expect(inline, 'not @theme inline').toBeUndefined();
    expect(body).toMatch(/--color-spert-blue:\s*#0070f3;/);
    expect(body).toMatch(/--color-spert-blue-light:\s*#0099ff;/);
    expect(body).toMatch(/--color-spert-blue-dark:\s*#0051cc;/);
  });
});
