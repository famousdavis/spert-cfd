// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { compile } from 'tailwindcss';
import { describe, it, expect } from 'vitest';

/**
 * What `src/app/globals.css` must do that nothing else would miss. Lint,
 * typecheck, the other tests and `next build` all pass without any of it.
 *
 * - The SPERT® blues (v0.17.9). Without the `@theme` block,
 *   `from-spert-blue-light`, `to-spert-blue-dark`, `bg-spert-blue` and
 *   `border-b-spert-blue` compile to nothing: the header's title renders as
 *   transparent text on no background, and the open tab's white label on no
 *   fill. The block must be a plain `@theme`, not `@theme inline`, so the
 *   utilities read the variables and a later dark value can override them.
 * - The dark variant (v0.17.9, v0.19.1). `dark:` must follow a `dark` class on
 *   an ancestor, never the operating system's setting: otherwise every `dark:`
 *   colour turns on for anyone whose computer is set to dark, before CFD's
 *   theme switch exists. And it must never apply in print (DASH26 O31), so a
 *   page printed in dark comes out light.
 * - `color-scheme` (v0.19.1, O27): `<html>` itself, which the variant cannot
 *   reach, turns the browser's own parts dark under the class, not in print.
 * - The chart (v0.19.1): recharts draws its axes and the Brush's background as
 *   SVG attributes, which these rules override in dark.
 *
 * v0.19.1 replaced v0.17.9's text match of the variant line with a compile of
 * the file by the app's own Tailwind: the variant became a block, and what
 * matters is the CSS it produces, not how the line is spelled.
 */
const APP = join(process.cwd(), 'src', 'app');
const GLOBALS = readFileSync(join(APP, 'globals.css'), 'utf8');
const resolve = createRequire(join(APP, 'globals.css')).resolve;

async function build(css: string, candidates: string[]): Promise<string> {
  const compiler = await compile(css, {
    base: APP,
    loadStylesheet: async (id: string) => {
      if (id !== 'tailwindcss') throw new Error(`unexpected @import ${id}`);
      const path = resolve('tailwindcss/index.css');
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
    },
  });
  return compiler.build(candidates);
}

/** Every top-level block of `css` whose text contains `needle`, braces balanced. */
function blocksContaining(css: string, needle: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') {
      if (depth === 0) start = css.lastIndexOf('\n', i) + 1;
      depth++;
    } else if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        const block = css.slice(start, i + 1);
        if (block.includes(needle)) out.push(block);
      }
    }
  }
  return out;
}

/** The selectors (and @-rules) enclosing the declaration `decl` in `css`, outermost first. */
function enclosing(css: string, decl: string): string[] {
  const at = css.indexOf(decl);
  if (at < 0) return [];
  const stack: string[] = [];
  let from = 0;
  for (let i = 0; i < at; i++) {
    if (css[i] === '{') {
      stack.push(css.slice(from, i).split(/[;}]/).pop()!.trim());
      from = i + 1;
    } else if (css[i] === '}') {
      stack.pop();
      from = i + 1;
    } else if (css[i] === ';') {
      from = i + 1;
    }
  }
  return stack;
}

describe('globals.css', () => {
  it('turns `dark:` on under a .dark ancestor, only off paper, never from the OS setting', async () => {
    const css = await build(GLOBALS, ['dark:bg-gray-900', 'bg-white']);
    const chain = enclosing(css, 'background-color: var(--color-gray-900)');
    // Control: the light utility compiles, so an empty chain below means a broken variant, not a broken build.
    expect(enclosing(css, 'background-color: var(--color-white)').length).toBeGreaterThan(0);
    expect(chain, 'the dark utility is emitted').not.toHaveLength(0);
    expect(chain.at(-1), 'selected by a .dark ancestor').toBe('.dark\\:bg-gray-900:is(.dark *)');
    expect(chain, 'not in print').toContain('@media not print');
    expect(css).not.toMatch(/prefers-color-scheme/);
  });

  it('sets color-scheme on html.dark, outside print', async () => {
    const css = await build(GLOBALS, []);
    const chain = enclosing(css, 'color-scheme: dark');
    expect(chain.at(-1)).toBe('html.dark');
    expect(chain).toContain('@media not print');
  });

  it("draws the chart's axes, ticks and Brush background in dark, outside print", async () => {
    const css = await build(GLOBALS, []);
    for (const [selector, decl] of [
      ['.recharts-cartesian-axis-line:is(.dark *)', 'stroke: var(--color-gray-400)'],
      ['.recharts-cartesian-axis-tick-value:is(.dark *)', 'fill: var(--color-gray-400)'],
      ['.recharts-brush > rect:first-of-type:is(.dark *)', 'fill: var(--color-gray-900)'],
    ]) {
      const block = blocksContaining(css, selector).join('\n');
      expect(block, selector).toContain(decl);
      expect(enclosing(block, decl), selector).toEqual(['@media not print', selector]);
    }
    // The variables those rules read are emitted.
    expect(css).toMatch(/--color-gray-400:/);
    expect(css).toMatch(/--color-gray-900:/);
  });

  it('defines the three SPERT® blues in a plain @theme block', () => {
    const css = GLOBALS.replace(/\/\*[\s\S]*?\*\//g, '');
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
