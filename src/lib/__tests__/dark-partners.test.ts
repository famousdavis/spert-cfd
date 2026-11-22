// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * Every light colour has a dark one (v0.19.1, DASH26 RD1, O32).
 *
 * From v0.19.1 every screen carries its dark colours, applied under the `dark`
 * class (set from v0.20.0 by the theme preference, theme.ts). A later change
 * that adds a light colour, a hover or a focus colour without its `dark:`
 * partner would put a light patch, or light text on a dark surface, into dark
 * mode, and no other check sees it:
 * the light screen is unchanged and nothing renders dark in the tests.
 *
 * The rule, per string literal (a class string): each Tailwind colour utility
 * with no `dark:` variant needs a `dark:` utility of the SAME property under the
 * SAME other variants (`hover:bg-…` needs `dark:hover:bg-…`) in the same
 * literal, unless its colour is one the colour table keeps in both themes
 * (ALLOWED below). Write the partner in the same literal, also in each branch
 * of a ternary. When a colour really is right in both themes, either write the
 * partner out (`dark:text-blue-600`, as the footer does) or add it to ALLOWED
 * with the reason.
 *
 * A side rule with no colour at all (`border-b`, `border-b-2`, `divide-y`) is
 * drawn in `currentColor`, the text colour: black in light, near-white in dark,
 * a light line across a dark window. Such a literal needs a border colour of
 * its own, at least a `dark:` one.
 *
 * Colours are every palette the installed Tailwind defines (read from its
 * theme.css, so a new palette such as 4.3's mauve, mist, olive and taupe is
 * seen), white and black, the SPERT® blues, and arbitrary colours: `[#…]`,
 * `[rgb(…)]`, `[hsl(…)]`, `[oklch(…)]`, `[lab(…)]`, `[var(…)]`, `[color:…]` and
 * named ones such as `[white]`.
 *
 * Not seen by this test (v0.19.1, PR #110 review -04, kept as known limits):
 * inline `style` colours; colours passed as JavaScript props (recharts); an
 * element with no colour class that inherits one; currentColor drawn by a bare
 * all-sides `border`, `ring-N` or `outline-N` (the shared button fragments take
 * their colour in another string); a side rule with an arbitrary width
 * (`border-b-[3px]`) or whose only colour is a hover one; and the browser's own
 * focus ring (`outline: auto`), which globals.css colours in dark. Those are
 * covered by the release's rendered checks and globals-css.test.ts.
 */

const require = createRequire(import.meta.url);
/** The palette names of the installed Tailwind (`--color-<name>-<shade>` in its theme.css). */
const THEME_PALETTES = [
  ...new Set(
    [...readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8').matchAll(/--color-([a-z]+)-\d+\s*:/g)].map((m) => m[1])
  ),
];

const ARBITRARY_COLOUR = '\\[(?:#|rgb|hsl|oklch|oklab|lab|lch|hwb|color:|var\\(|0_|[a-z]+\\])';
const PALETTE = `(?:${THEME_PALETTES.join('|')})-\\d{2,3}|white|black|spert-blue(?:-light|-dark)?|${ARBITRARY_COLOUR}`;
const PROPERTY =
  '(bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|divide|outline|fill|stroke|from|to|via|placeholder|accent|shadow|decoration|caret)';
const TOKEN = new RegExp(
  `(?<![\\w\\[/:!-])((?:[\\w\\-/\\[\\]@()&*.,=]+?:)*)!?${PROPERTY}-((?:${PALETTE})[^\\s'"\`}]*)`,
  'g'
);
/** A one-side rule or divider with no colour of its own: drawn in currentColor. */
const SIDE_RULE = /(?<![\w:/[-])((?:border-[trblxy]|divide-[xy])(?:-[1-9]\d*)?)(?=\s)/;
const RULE_COLOUR = new RegExp(
  `(?<![\\w/[-])(?:[\\w-]+:)*!?(?:border(?:-[trblxy])?|divide)-(?:${PALETTE}|transparent)`
);

/**
 * The string literals of `source`, each as its text and start offset. A template literal's
 * `${…}` expressions are cut out of its text and scanned on their own, so each branch of
 * `${ok ? 'a' : 'b'}` is its own literal: a partner in the other branch does not count.
 * Comments are skipped.
 */
function literals(source: string): { text: string; index: number }[] {
  const out: { text: string; index: number }[] = [];
  let i = 0;

  /** Past a comment starting at i, or i itself when none starts there. */
  const skipComment = (): boolean => {
    if (source[i] !== '/' || (source[i + 1] !== '/' && source[i + 1] !== '*')) return false;
    const [close, width] = source[i + 1] === '/' ? ['\n', 0] : ['*/', 2];
    const end = source.indexOf(close, i + 2);
    i = end < 0 ? source.length : end + width;
    return true;
  };

  /** A '…' or "…" literal starting at i; it cannot cross a line. */
  const quoted = (): void => {
    const quote = source[i];
    const start = i++;
    let text = '';
    while (i < source.length && source[i] !== quote && source[i] !== '\n') {
      if (source[i] === '\\') i++;
      text += source[i++] ?? '';
    }
    i++;
    out.push({ text, index: start });
  };

  /** A `…` literal starting at i: its text without the ${…} parts, which are read as code. */
  const template = (): void => {
    const start = i++;
    let text = '';
    while (i < source.length && source[i] !== '`') {
      if (source[i] === '$' && source[i + 1] === '{') {
        i += 2;
        text += ' ';
        code(true);
        i++; // the closing }
      } else {
        if (source[i] === '\\') i++;
        text += source[i++] ?? '';
      }
    }
    i++;
    out.push({ text, index: start });
  };

  /** Code from i to the end, or (inside a template's ${…}) to its unmatched closing brace. */
  function code(inTemplate: boolean): void {
    let depth = 0;
    while (i < source.length && !(inTemplate && depth === 0 && source[i] === '}')) {
      if (!skipComment()) depth += step();
    }
  }

  /** One token of code at i: a literal is read whole; returns the change in brace depth. */
  function step(): number {
    const c = source[i];
    if (c === "'" || c === '"') quoted();
    else if (c === '`') template();
    else i++;
    return c === '{' ? 1 : c === '}' ? -1 : 0;
  }

  code(false);
  return out;
}

/**
 * Colours the colour table keeps unchanged in dark (its U rows), and why. A pattern that starts with
 * `^(` names its variants and is matched against the whole token, so it covers only those uses; the
 * others are matched against the utility without its variants.
 */
const ALLOWED: [RegExp, string][] = [
  [/^text-white$/, 'white labels on the blue and red buttons'],
  [/^bg-(blue|red)-(600|700)$/, 'primary and destructive buttons and their hover, in both themes'],
  [/^bg-black\/\d+$/, 'window overlays'],
  [/^ring-white\/\d+$/, 'the logo ring'],
  [/^bg-spert-blue$|^border-spert-blue$|^border-b-spert-blue$|^from-spert-blue-light$|^to-spert-blue-dark$/, 'SPERT® brand blue: buttons, the title'],
  [/^bg-\[#005bc4\]$|^border-\[#005bc4\]$/, 'the brand-blue buttons’ hover'],
  [/^accent-blue-600$/, 'checkboxes and radios: the browser draws the box from color-scheme'],
  [
    /^(focus|focus-visible):(ring-blue-500|border-blue-500)$/,
    'focus rings and a focused border: 3.9:1 or more on the page, raised surfaces and the WIP tint. Not on a field (#364153, 2.74:1): the sharing textarea, the one field that uses them, takes blue-400 in dark',
  ],
  [/^ring-amber-400$/, 'the WIP-violation ring'],
  [
    /^(disabled:hover:)?text-gray-400$/,
    'muted text: 6.8:1 on the page, 5.6:1 on raised surfaces, 4.6:1 on #2d3748. On a field-coloured surface (#364153) it is 3.96:1: only the header chip’s "Local only" on its hover, Forecaster’s (O30)',
  ],
  [/^shadow-\[0_20px_60px_rgba\(0,0,0,0\.3\)\]$/, 'the project dialog’s drop shadow'],
  [/^shadow-\[0_0_0_1\.5px_rgba\([\d,.]+\)\]$/, 'the icon buttons’ coloured hover / focus ring, drawn in both themes as Forecaster does'],
];

function allowed(token: string, bare: string): boolean {
  return ALLOWED.some(([re]) => re.test(re.source.startsWith('^(') ? token : bare));
}

const variantsOf = (v: string) =>
  v
    .split(':')
    .filter((p) => p && p !== 'dark')
    .join(':');

/** The light colour utilities in `source` that have no dark partner, as `line:token`. */
export function unpairedLightColours(source: string): string[] {
  const out: string[] = [];
  for (const lit of literals(source)) {
    const body = ` ${lit.text} `;
    const tokens = [...body.matchAll(TOKEN)].map((m) => ({
      variants: m[1],
      property: m[2],
      value: m[3],
      offset: m.index!,
    }));
    const dark = new Set(
      tokens.filter((t) => t.variants.includes('dark:')).map((t) => `${variantsOf(t.variants)}|${t.property}`)
    );
    const side = body.match(SIDE_RULE);
    if (side && !RULE_COLOUR.test(body)) {
      out.push(`${source.slice(0, lit.index).split('\n').length}:${side[1]} (currentColor rule)`);
    }
    for (const t of tokens) {
      if (t.variants.includes('dark:')) continue;
      if (dark.has(`${variantsOf(t.variants)}|${t.property}`)) continue;
      const bare = `${t.property}-${t.value}`;
      if (allowed(`${t.variants}${bare}`, bare)) continue;
      const line = source.slice(0, lit.index).split('\n').length;
      out.push(`${line}:${t.variants}${bare}`);
    }
  }
  return out;
}

function productionFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== '__tests__') out.push(...productionFiles(path));
    } else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) {
      out.push(path);
    }
  }
  return out;
}

const SRC = join(process.cwd(), 'src');

describe('every light colour has a dark partner', () => {
  it('finds an unpaired hover and focus-visible colour (must-find control)', () => {
    const bad = "const A = 'bg-white dark:bg-gray-900 hover:bg-gray-50 focus-visible:ring-blue-300 text-white';";
    expect(unpairedLightColours(bad)).toEqual(['1:hover:bg-gray-50', '1:focus-visible:ring-blue-300']);
  });

  it('passes the same colours once each has its partner, in every branch of a ternary', () => {
    const good =
      "const A = 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-700 text-white';\n" +
      "const B = ok ? 'border-gray-300 dark:border-gray-600' : 'border-red-400 dark:border-red-400';";
    expect(unpairedLightColours(good)).toEqual([]);
    // A partner in the OTHER branch does not count, also inside a template literal.
    expect(unpairedLightColours("const B = ok ? 'border-gray-300' : 'dark:border-gray-600';")).toEqual([
      '1:border-gray-300',
    ]);
    expect(
      unpairedLightColours("const T = `w-full border ${ok ? 'border-gray-300' : 'border-red-400 dark:border-red-400'}`;")
    ).toEqual(['1:border-gray-300']);
    // A side rule drawn in currentColor needs a colour; a dark one is enough.
    expect(unpairedLightColours("const E = 'flex border-b px-4';")).toEqual(['1:border-b (currentColor rule)']);
    expect(unpairedLightColours("const F = 'flex border-b dark:border-gray-700 px-4';")).toEqual([]);
    // v0.19.1 review -04: a rule with a width, the newer palettes, arbitrary colours.
    expect(unpairedLightColours("const G = 'flex border-b-2 px-4';")).toEqual(['1:border-b-2 (currentColor rule)']);
    expect(unpairedLightColours("const H = 'bg-mauve-50 text-taupe-700';")).toEqual(['1:bg-mauve-50', '1:text-taupe-700']);
    expect(
      unpairedLightColours("const I = 'text-[var(--link)] bg-[oklch(0.9_0.02_250)] border-[hsl(0,0%,90%)] fill-[white]';")
    ).toEqual(['1:text-[var(--link)]', '1:bg-[oklch(0.9_0.02_250)]', '1:border-[hsl(0,0%,90%)]', '1:fill-[white]']);
    // The allowlist covers only the uses it names: muted grey at rest, a blue focus ring.
    expect(unpairedLightColours("const J = 'text-gray-400 focus-visible:ring-blue-500';")).toEqual([]);
    expect(unpairedLightColours("const K = 'hover:text-gray-400 ring-blue-500';")).toEqual([
      '1:hover:text-gray-400',
      '1:ring-blue-500',
    ]);
    // A comment is not a class string.
    expect(unpairedLightColours("// write 'hover:bg-gray-50' with a partner\nconst D = 1;")).toEqual([]);
    // A partner under different variants does not count.
    expect(unpairedLightColours("const C = 'hover:text-gray-900 dark:text-gray-100';")).toEqual([
      '1:hover:text-gray-900',
    ]);
  });

  it('reads the production class strings (the reader is not silently empty)', () => {
    const files = productionFiles(SRC);
    let tokens = 0;
    for (const f of files) {
      for (const lit of literals(readFileSync(f, 'utf8'))) {
        tokens += [...` ${lit.text} `.matchAll(TOKEN)].length;
      }
    }
    expect(THEME_PALETTES).toEqual(expect.arrayContaining(['gray', 'amber', 'mauve', 'mist', 'olive', 'taupe']));
    expect(files.length).toBeGreaterThan(90);
    expect(tokens).toBeGreaterThan(600);
  });

  it('holds for every production file', () => {
    const found: string[] = [];
    for (const f of productionFiles(SRC)) {
      for (const u of unpairedLightColours(readFileSync(f, 'utf8'))) {
        found.push(`${relative(SRC, f)}:${u}`);
      }
    }
    expect(found).toEqual([]);
  });
});
