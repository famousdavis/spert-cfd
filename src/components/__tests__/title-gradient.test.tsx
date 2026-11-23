// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

/**
 * The header's SPERT® CFD is drawn as a gradient in CFD's favicon purple (#7c3aed; HDR26, DASH26 RT, v0.20.1),
 * and every point of it stays readable on the page behind it, in both themes.
 *
 * ⚠️ jsdom has no paint, so the colours here are read, not measured: the end colours from `app-header.tsx`'s
 * source, the page's background from `app-shell.tsx`'s classes resolved through the installed Tailwind's own
 * `theme.css`, and the contrast computed here from the WCAG 2.x definition. The rendered page was measured in
 * headless Chrome when this was written (both themes set by the header switch, five widths, print and increased
 * contrast). The colour maths is the HDR26 plan's Appendix A, typed; copied from SPERT® Story Map's guard, not
 * shared.
 *
 * The bar is 3 : 1 at every point of each ramp. The title is bold and at least 24 px at every width (`text-2xl`;
 * 28 px from 640 px, 33.6 px from 768 px), which is large text at every width, and 3 : 1 is the owner's bar for a
 * title that stays large (WCAG exempts logotypes). The dark ramp clears it by hundredths (3.02), on purpose: the
 * pinned background below is what catches a change that would sink it.
 *
 * T2 pins the class string exactly, so most edits to it go red there first. The other tests each check one reason
 * the string is what it is; they are what guards a deliberate change of the string, when T2's pin moves with it.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { compile } from 'tailwindcss';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({ mode: 'local' }),
}));

import { AppHeader } from '../app-header';

const SRC = join(process.cwd(), 'src');
const HEADER = join(SRC, 'components', 'app-header.tsx');
const SHELL = join(SRC, 'components', 'app-shell.tsx');
const COLUMN = join(SRC, 'components', 'page-column.ts');
const LAYOUT = join(SRC, 'app', 'layout.tsx');
const GLOBALS = join(SRC, 'app', 'globals.css');
const resolveFromApp = createRequire(GLOBALS).resolve;
const THEME_CSS = resolveFromApp('tailwindcss/theme.css');

const BAR = 3;
/** The page behind the title in each theme: measured in Chrome (`getComputedStyle`, through a canvas). */
const PREMISE = { light: '#ffffff', dark: '#101828' } as const;
/** "SPERT" and "CFD": one gradient per word, with the ® between them. */
const GRADIENT_SPANS = 2;
/** HDR26-CFD-ROW 5b's class string, exactly (DASH26 R34; HDR26 D5 colours, D10 fallbacks). */
const SPEC =
  'bg-gradient-to-r from-[#9468fd] to-[#6117c5] dark:from-[#aa8fff] dark:to-[#783de3] bg-clip-text text-transparent print:bg-none print:text-black contrast-more:bg-none contrast-more:text-black dark:contrast-more:text-gray-100';

function need<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`not found: ${what}`);
  return value;
}

// ---- Appendix A (HDR26 plan v7), typed --------------------------------------------------------------------------

type Triple = [number, number, number];

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const delin = (v: number) =>
  Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)));
const rgb = (h: string): Triple => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as Triple;
const hex = (a: number[]) => '#' + a.map((v) => v.toString(16).padStart(2, '0')).join('');
const luminance = (h: string) => {
  const [r, g, b] = rgb(h).map(lin) as Triple;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** A contrast ratio to two decimals, truncated: never rounded up across a bar. */
const trunc = (n: number) => (Math.floor(n * 100) / 100).toFixed(2);

const toOklab = (h: string): Triple => {
  const [r, g, b] = rgb(h).map(lin) as Triple;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const linFromOklab = ([lk, a, b]: Triple): Triple => {
  const l = (lk + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lk - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lk - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};
const fromOklab = (lab: Triple) => hex(linFromOklab(lab).map(delin));
const toLch = (h: string): Triple => {
  const [lk, a, b] = toOklab(h);
  return [lk, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
};
const lab = ([lk, c, h]: Triple): Triple => [lk, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];
const inGamut = (lch: Triple) => linFromOklab(lab(lch)).every((v) => v >= -1e-6 && v <= 1 + 1e-6);
/** Fit to sRGB by cutting chroma at fixed lightness and hue; never by clamping channels, which turns the hue. */
const fromLch = ([lk, c, h]: Triple) => {
  let fit = c;
  if (!inGamut([lk, c, h])) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut([lk, mid, h])) lo = mid;
      else hi = mid;
    }
    fit = lo;
  }
  return fromOklab(lab([lk, fit, h]));
};

/** A colour as Tailwind's theme.css writes it: `#rgb`, `#rrggbb`, or `oklch(L% C H)` with H possibly `none`. */
function parseCssColor(value: string): string {
  const v = value.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(v);
  if (short) return '#' + Array.from(need(short[1], 'short hex')).map((c) => c + c).join('').toLowerCase();
  const long = /^#([0-9a-f]{6})$/i.exec(v);
  if (long) return '#' + need(long[1], 'hex').toLowerCase();
  const ok = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+|none)\s*\)$/i.exec(v);
  if (ok) {
    const [, l, c, h] = ok;
    return fromOklab(lab([Number(l) / 100, Number(c), h === 'none' ? 0 : Number(h)]));
  }
  throw new Error('unreadable color: ' + v);
}

/**
 * The weakest contrast along a ramp, 41 samples. `oklab` is how Tailwind 4's `bg-gradient-to-r` interpolates
 * (`to right in oklab`); `srgb` is a plain gradient's. Both are checked, so a change of interpolation cannot pass.
 */
function weakest(e1: string, e2: string, ground: string, space: 'oklab' | 'srgb'): number {
  const [a, b] = [toOklab(e1), toOklab(e2)];
  const [p, q] = [rgb(e1), rgb(e2)];
  const mix = (x: number[], y: number[], t: number) => x.map((v, k) => v + (need(y[k], 'channel') - v) * t);
  let min = Infinity;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const c = space === 'oklab' ? fromOklab(mix(a, b, t) as Triple) : hex(mix(p, q, t).map(Math.round));
    min = Math.min(min, contrast(c, ground));
  }
  return min;
}

// ---- Reading the source ---------------------------------------------------------------------------------------

const read = (file: string) => readFileSync(file, 'utf8');
const classList = (raw: string) => raw.split(/\s+/).filter(Boolean);

/** Every `const NAME = '…'` (or "…") in a file, the string on the same line or the next, so `{NAME}` resolves. */
function stringConstants(text: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const m of text.matchAll(/\bconst\s+([A-Za-z_]\w*)\s*=\s*(?:'([^'\n]*)'|"([^"\n]*)")/g)) {
    found.set(need(m[1], 'name'), need(m[2] ?? m[3], 'value'));
  }
  return found;
}

/** The constants a `className` in app-header.tsx can name: its own, and the PAGE_COLUMN it imports. */
const headerConstants = () => new Map([...stringConstants(read(COLUMN)), ...stringConstants(read(HEADER))]);

/** `TITLE_GRADIENT`'s string, read where it is defined. */
const titleGradient = () =>
  need(/\bconst TITLE_GRADIENT\s*=\s*'([^'\n]*)'/.exec(read(HEADER))?.[1], 'const TITLE_GRADIENT = …');

/** The title: app-header.tsx's one `<h1 className=…>` element, up to its closing tag (comments may name `<h1>`). */
function titleH1(text: string): string {
  const opens = Array.from(text.matchAll(/<h1\s+className=/g), (m) => m.index);
  const start = need(opens[0], 'the title <h1>');
  const end = text.indexOf('</h1>', start);
  if (opens.length !== 1 || end === -1) throw new Error('app-header.tsx: not exactly one <h1> element');
  return text.slice(start, end);
}

const h1Classes = () => classList(need(/^<h1\s+className="([^"]*)"/.exec(titleH1(read(HEADER)))?.[1], '<h1> classes'));

/** JSX text as rendered: `{' x'}` / `{"x"}` unwrapped; a line break and its indentation is no text at all. */
function jsxText(raw: string): string {
  return raw
    .replace(/\s*\n\s*/g, '')
    .replace(/\{'([^']*)'\}|\{"([^"]*)"\}/g, (_, a: string | undefined, b: string | undefined) => a ?? b ?? '');
}

interface TitleSpan {
  classes: string[];
  text: string;
}

const SPAN = /<span\s+className=(?:"([^"]*)"|'([^']*)'|\{(\w+)\})>([^<]*)<\/span>/g;

/**
 * Every span in the title, in order: a literal `className="…"`, or a `className={NAME}` resolved through the file's
 * string constants. A name that does not resolve, or a span of any other shape, fails loudly, so no span can escape
 * the census by carrying its classes some other way.
 */
function titleSpans(text: string): TitleSpan[] {
  const h1 = titleH1(text);
  const constants = stringConstants(text);
  const spans = Array.from(h1.matchAll(SPAN), (m) => {
    const raw = m[1] ?? m[2] ?? constants.get(need(m[3], 'constant name'));
    if (raw === undefined) throw new Error(`app-header.tsx: className={${m[3]}} is not a string constant`);
    return { classes: classList(raw), text: jsxText(need(m[4], 'span text')) };
  });
  if (spans.length !== (h1.match(/<span\b/g) ?? []).length) throw new Error('app-header.tsx: a title span the guard cannot read');
  return spans;
}

/** The gradient spans, found by `bg-clip-text` in their classes (never by the constant's name), counted. */
function censused(): TitleSpan[] {
  const spans = titleSpans(read(HEADER)).filter((s) => s.classes.includes('bg-clip-text'));
  if (spans.length !== GRADIENT_SPANS) throw new Error(`app-header.tsx: ${spans.length} gradient spans, expected ${GRADIENT_SPANS}`);
  return spans;
}

/** The `<h1>`'s own text, between its spans, as rendered. (Its opening tag is matched by its className, which may hold `>`.) */
const h1OwnText = () => jsxText(titleH1(read(HEADER)).replace(/^<h1\s+className="[^"]*"\s*>/, '').replace(SPAN, ''));

/** The one class with this exact variant and utility, e.g. `dark:` + `from-` → `#aa8fff`. Exactly one, or it fails. */
function endColor(classes: string[], variant: '' | 'dark:', utility: 'from' | 'to'): string {
  const pattern = new RegExp(`^${variant}${utility}-\\[(#[0-9a-f]{6})\\]$`, 'i');
  const hits = classes.flatMap((c) => pattern.exec(c)?.[1] ?? []);
  if (hits.length !== 1) throw new Error(`${variant}${utility}-[#…]: found ${hits.length}, expected exactly 1`);
  return need(hits[0], 'end colour').toLowerCase();
}

const endsOf = (classes: string[]) => ({
  light: [endColor(classes, '', 'from'), endColor(classes, '', 'to')] as const,
  dark: [endColor(classes, 'dark:', 'from'), endColor(classes, 'dark:', 'to')] as const,
});

/**
 * A class list's one colour class for a variant: `bg-white` → `white` for `bg-`, `dark:bg-gray-900` → `gray-900`.
 * Only colour shapes count, so `text-2xl` or `text-base` is never read as a colour.
 */
function colorToken(classes: string[], head: string): string {
  const shape = new RegExp(`^${head}(?:white|black|[a-z]+-\\d{2,3})$`);
  const hits = classes.filter((c) => shape.test(c)).map((c) => c.slice(head.length));
  if (hits.length !== 1) throw new Error(`${head}…: found ${hits.length}, expected exactly 1`);
  return need(hits[0], 'colour token');
}

/** A Tailwind colour token's value in the installed theme.css (`white` → `#fff`), as #rrggbb. */
function themeColor(token: string): string {
  const m = new RegExp(`--color-${token}:\\s*([^;]+);`).exec(read(THEME_CSS));
  return parseCssColor(need(m?.[1], `theme.css --color-${token}`));
}

/** An element on the way to the title: its tag and its classes. */
interface Tagged {
  tag: string;
  classes: string[];
}

/**
 * Every `className` in a stretch of JSX, in order, with the tag it sits on, as the browser gets it: `"…"`, `{NAME}`,
 * or a template literal whose `${NAME}` parts are resolved. Anything else (an unknown name, a call, a ternary) fails
 * loudly: a class the guard cannot read could paint a ground it cannot see.
 */
function classNamesIn(jsx: string, constants: Map<string, string>): Tagged[] {
  const out: Tagged[] = [];
  const resolveName = (name: string) => {
    const value = constants.get(name);
    if (value === undefined) throw new Error(`className names ${name}, which is not a string constant`);
    return value;
  };
  for (const m of jsx.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{(\w+)\}|(.))/g)) {
    if (m[4] !== undefined) throw new Error(`a className the guard cannot read: ${jsx.slice(m.index ?? 0).slice(0, 60)}`);
    const raw =
      m[1] ?? (m[2] !== undefined ? m[2].replace(/\$\{(\w+)\}|\$\{[^}]*\}/g, (all, n?: string) => {
        if (!n) throw new Error(`a template className the guard cannot read: ${all}`);
        return resolveName(n);
      }) : resolveName(need(m[3], 'className name')));
    const tag = need(/^<([\w.]+)/.exec(jsx.slice(jsx.lastIndexOf('<', m.index ?? 0)))?.[1], 'the tag of a className');
    out.push({ tag, classes: classList(raw) });
  }
  return out;
}

/** app-shell from its last `return (` before `<AppHeader` up to it: the element that wraps the header. */
function shellStretch(): string {
  const shell = read(SHELL);
  const at = shell.indexOf('<AppHeader');
  return shell.slice(shell.lastIndexOf('return (', at), at);
}

/** app-header from `<header className=` through the `<h1 …>` opening tag (matched by its className, which may hold `>`). */
function headerStretch(): string {
  const header = read(HEADER);
  const from = header.indexOf('<header className=');
  const open = need(/<h1\s+className=(?:"[^"]*"|\{`[^`]*`\}|\{\w+\})[^>]*>/.exec(header.slice(from)), 'the <h1> opening tag');
  return header.slice(from, from + open.index + open[0].length);
}

/**
 * The title's ground: app-shell's element that wraps `<AppHeader`, its first className. Everything else on the way:
 * any other className in that stretch, and every className in the header from `<header` down to and including the
 * `<h1>` (the logos, siblings on the way, among them).
 */
function groundChain(): { ground: Tagged; between: Tagged[] } {
  const [ground, ...rest] = classNamesIn(shellStretch(), new Map());
  return { ground: need(ground, "app-shell's wrapper classes"), between: [...rest, ...classNamesIn(headerStretch(), headerConstants())] };
}

/** The body's classes (layout.tsx): its text colours are the page's own, which the title's solid fallbacks repeat. */
function bodyClasses(): string[] {
  // The whole opening tag: one more attribute (an inline style) and this fails.
  const raw = need(/<body\s+className=\{`([^`]*)`\}\s*>/.exec(read(LAYOUT))?.[1], 'layout.tsx <body className={`…`}>');
  return classList(raw.replace(/\$\{[^}]*\}/g, ' '));
}

/** A class as its variants and its utility; a `:` inside brackets or parentheses stays: `[&_span]:text-white`. */
function splitClass(cls: string): { variants: string[]; utility: string } {
  const variants: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < cls.length; i++) {
    const c = cls.charAt(i);
    if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') depth--;
    else if (c === ':' && depth === 0) {
      variants.push(cls.slice(start, i));
      start = i + 1;
    }
  }
  // Without `!` and without a `/…` modifier outside brackets (`text-white/50`, `text-base/7`).
  return { variants, utility: cls.slice(start).replace(/^!/, '').replace(/\/[^/\]]*$/, '') };
}

/** A variant that styles elements other than the one carrying it: children `*:`, descendants `**:`, any `[…]:`. */
const reaches = (variant: string) => variant === '*' || variant === '**' || variant.startsWith('[');
/** Fades, filters, blends, hides or shadows the element and everything in it; or an arbitrary property (`[color:…]`). */
const FADES =
  /^(?:opacity-|brightness-|contrast-|blur(?:-|$)|filter(?:-|$)|invert(?:-|$)|grayscale(?:-|$)|sepia(?:-|$)|saturate-|-?hue-rotate-|mix-blend-|text-shadow(?:-|$)|hidden$|invisible$|sr-only$|collapse$|\[[a-z-]+:)/;
/** A text colour, never a size: a palette shade, white, black, transparent, current, inherit, or an arbitrary colour. */
const TEXT_COLOUR = /^text-(?:white|black|transparent|current|inherit|[a-z]+-\d{2,3}|\[(?:#|rgb|hsl|oklch|oklab|lab|lch|hwb|color:|var\().*\])$/;
/** The other `text-` utilities that are neither a colour nor a size. */
const TEXT_OTHER = /^text-(?:left|center|right|justify|start|end|wrap|nowrap|balance|pretty|clip|ellipsis|shadow(?:-.*)?)$/;

type Kind = 'body' | 'ground' | 'between';
/**
 * The classes T8 refuses on one element. On the body, the ground wrapper and everything between it and the title: a
 * variant that reaches other elements, and a fade, filter, blend, hide, text shadow or arbitrary property. From the
 * ground down, a text colour too (the body's is the page's own text colour, which the fallbacks repeat). Below the
 * ground, any background. An `<img>` holds nothing, so on a logo only the reaching variants count (its `hidden` is its
 * own business).
 */
function refused(el: Tagged, kind: Kind): string[] {
  return el.classes.filter((cls) => {
    const { variants, utility } = splitClass(cls);
    if (variants.some(reaches)) return true;
    if (el.tag === 'img') return false;
    if (FADES.test(utility)) return true;
    if (kind !== 'body' && TEXT_COLOUR.test(utility)) return true;
    return kind === 'between' && utility.startsWith('bg-');
  });
}

/**
 * Every class that sets the text's size, whatever its variants (`md:`, `max-sm:`, `min-[700px]:`), with its size in px:
 * a named size through theme.css, an arbitrary px or rem value. Any other `text-` class that is neither a colour nor
 * one of the non-size utilities fails loudly, so no size goes unread.
 */
function sizesPx(classes: string[]): { cls: string; px: number }[] {
  const out: { cls: string; px: number }[] = [];
  for (const cls of classes) {
    const { utility } = splitClass(cls);
    if (!utility.startsWith('text-') || TEXT_COLOUR.test(utility) || TEXT_OTHER.test(utility)) continue;
    const named = /^text-(xs|sm|base|lg|\d?xl)$/.exec(utility);
    const arbitrary = /^text-\[(\d*\.?\d+)(px|rem)\]$/.exec(utility);
    if (named) {
      const rem = need(new RegExp(`--text-${named[1]}:\\s*([\\d.]+)rem;`).exec(read(THEME_CSS))?.[1], `theme.css --text-${named[1]}`);
      out.push({ cls, px: Number(rem) * 16 });
    } else if (arbitrary) {
      out.push({ cls, px: Number(arbitrary[1]) * (arbitrary[2] === 'rem' ? 16 : 1) });
    } else {
      throw new Error(`a text class whose size the guard cannot read: ${cls}`);
    }
  }
  return out;
}

// ---- Compiled CSS (CFD's real globals.css, by the app's own Tailwind; globals-css.test.ts's loader) -------------

async function compileCss(css: string, candidates: string[]): Promise<string> {
  const compiler = await compile(css, {
    base: dirname(GLOBALS),
    loadStylesheet: async (id: string) => {
      if (id !== 'tailwindcss') throw new Error(`unexpected @import ${id}`);
      const path = resolveFromApp('tailwindcss/index.css');
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
    },
  });
  return compiler.build(candidates);
}

const compileGlobals = (candidates: string[]) => compileCss(read(GLOBALS), candidates);

/** Every rule of compiled CSS that has a selector: its path (the @-rules around it, then the selector) and selector. */
function rulesIn(css: string): { path: string; selector: string }[] {
  const out: { path: string; selector: string }[] = [];
  const stack: string[] = [];
  let from = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css.charAt(i);
    if (c === '{') {
      const prelude = css.slice(from, i).trim();
      stack.push(prelude);
      if (!prelude.startsWith('@')) out.push({ path: stack.join(' » '), selector: prelude });
      from = i + 1;
    } else if (c === '}') {
      stack.pop();
      from = i + 1;
    } else if (c === ';') {
      from = i + 1;
    }
  }
  return out;
}

/** A selector that names `header`, `h1` or `span` as an element type: one that can select the title or its words. */
const NAMES_TITLE = /(?:^|[\s>+~,(])(?:header|h1|span)(?=$|[\s>+~,.:#[)])/;

/** A class's selector as Tailwind escapes it. */
const selectorOf = (cls: string) => '.' + cls.replace(/[:[\]#@()!.]/g, (m) => '\\' + m);

/** Where a class's own rule starts in compiled CSS (its whole selector), or -1. */
function ruleAt(css: string, cls: string): number {
  const selector = selectorOf(cls);
  let i = css.indexOf(selector);
  while (i !== -1 && /[\w\\-]/.test(css.charAt(i + selector.length))) i = css.indexOf(selector, i + 1);
  return i;
}

/** The @-rules and selectors enclosing position `at`, outermost first. */
function enclosingAt(css: string, at: number): string[] {
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

/** The rule starting at `at`: its selector, and its block with every nested block, braces balanced. */
function ruleBlock(css: string, at: number): { selector: string; block: string } {
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return { selector: css.slice(at, open).trim(), block: css.slice(open, i + 1) };
  }
  throw new Error('unbalanced CSS');
}

// ---- The guard --------------------------------------------------------------------------------------------------

describe("the header's SPERT® CFD: a gradient in CFD's purple, readable in both themes (HDR26, DASH26 RT)", () => {
  describe('T1 instrument self-checks', () => {
    it('T1 the contrast formula: #767676 on white is 4.54 : 1', () => {
      expect(trunc(contrast('#767676', '#ffffff'))).toBe('4.54');
    });

    it("T1 the OKLCH steps rebuild the suite's old blue gradient from #0070f3, with its hue turns", () => {
      // As Appendix A writes it. Algebraically this is a round trip of #0099ff and #0051cc through OKLCH and the
      // gamut fit, so it checks those conversions, not the steps themselves.
      const [p, g1, g2] = ['#0070f3', '#0099ff', '#0051cc'].map(toLch) as [Triple, Triple, Triple];
      const stepOf = (g: Triple): Triple => [g[0] - p[0], g[1] / p[1], g[2] - p[2]];
      const withTurn = (fav: string, d: Triple) => {
        const [lk, c, h] = toLch(fav);
        return fromLch([lk + d[0], c * d[1], h + d[2]]);
      };
      expect(withTurn('#0070f3', stepOf(g1))).toBe('#0099ff');
      expect(withTurn('#0070f3', stepOf(g2))).toBe('#0051cc');
    });

    it("T1 parseCssColor reads Tailwind's #fff and 'none'-hue forms, and refuses what it cannot read", () => {
      expect(parseCssColor('#fff')).toBe('#ffffff');
      expect(parseCssColor('oklch(98.5% 0 none)')).toBe('#fafafa');
      expect(() => parseCssColor('rgb(1, 2, 3)')).toThrow(/unreadable/);
    });

    it('T1 the ramp sampler fails a known-bad: the old blue gradient is 2.99 : 1 on white and 2.57 on gray-900', () => {
      // Vacuity control: a sampler that always passed would pass every ramp below.
      expect(trunc(weakest('#0099ff', '#0051cc', PREMISE.light, 'oklab'))).toBe('2.99');
      expect(trunc(weakest('#0099ff', '#0051cc', PREMISE.dark, 'oklab'))).toBe('2.57');
    });
  });

  it('T2 the class string is exactly the approved one, on the constant and on every gradient span', () => {
    // Exact: no other class, no `!` (an !important colour beats the print fallback whatever the order), no
    // `dark:print:` (dead under CFD's variant). A deliberate change moves this pin and must still pass T6–T13.
    expect(titleGradient()).toBe(SPEC);
    for (const span of censused()) expect(span.classes, span.text).toEqual(SPEC.split(' '));
  });

  it('T3 the title has exactly two gradient spans, SPERT and CFD, found by bg-clip-text, and reads "SPERT®CFD" in spans', () => {
    // Must-find, and the census: a reader that found nothing would pass every test below.
    expect(censused().map((s) => s.text)).toEqual(['SPERT', 'CFD']);
    expect(titleSpans(read(HEADER)).map((s) => s.text).join('')).toBe('SPERT®CFD');
  });

  it("T4 the space and the weight are the <h1>'s: its own text is the space, and font-bold is on it, not on a span", () => {
    // HDR26 F1/W3: inside a span, jsdom's accessible name loses a leading space; and with the system font a space's
    // width depends on its weight, so the element holding the space carries the words' weight.
    expect(h1OwnText()).toBe(' ');
    for (const span of censused()) {
      expect(span.text, span.text).toBe(span.text.trim());
      expect(span.classes.filter((c) => /(?:^|:)font-/.test(c)), `${span.text}: a weight on the span`).toEqual([]);
    }
    expect(h1Classes()).toContain('font-bold');
    // The ® keeps its own normal weight inside the bold <h1>.
    const mark = need(titleSpans(read(HEADER)).find((s) => s.text === '®'), 'the ® span');
    expect(mark.classes).toContain('font-normal');
  });

  it('T5 the heading is named "SPERT® CFD", with its space (jsdom; Chrome names both shapes alike)', () => {
    render(<AppHeader onOpenModal={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'SPERT® CFD' })).toBeTruthy();
  });

  it('T6 both gradient spans carry the same four end colours', () => {
    const [first, ...rest] = censused().map((s) => endsOf(s.classes));
    expect(first).toBeDefined();
    for (const other of rest) expect(other).toEqual(first);
  });

  it("T7 the page behind the title resolves, through the installed Tailwind, to the pinned premise in each theme", () => {
    const { ground } = groundChain();
    expect(themeColor(colorToken(ground.classes, 'bg-'))).toBe(PREMISE.light);
    expect(themeColor(colorToken(ground.classes, 'dark:bg-'))).toBe(PREMISE.dark);
  });

  it(
    'T8 from the body to the title, no class fades, filters, blends, hides or text-shadows it, or reaches it from ' +
      'another element; from the ground down none sets a text colour, below it none a background; no inline style',
    () => {
      // The wrapper is the title's ground only while nothing in between paints one, and a fade would sink a ramp that
      // clears the bar by hundredths. Refused, on the body, app-shell's ground wrapper and every element from <header>
      // to the <h1>: opacity; brightness, contrast, blur, filter, grayscale, invert, sepia, saturate, hue-rotate;
      // mix-blend; hidden, invisible, sr-only, collapse; text-shadow; an arbitrary property (`[color:…]`); and a child,
      // descendant or arbitrary variant (`*:`, `**:`, `[&…]:`). The logos hold nothing: only those variants count there.
      // Read from what is really there: the body's and the <header>'s template literals, PAGE_COLUMN resolved from
      // page-column.ts. Not seen: a style sheet other than globals.css (there is none; T15 reads globals.css), styles
      // set from script, and every other way a class could move or shrink the title out of sight (a transform, a zero
      // height, a clip).
      const { ground, between } = groundChain();
      const body: Tagged = { tag: 'body', classes: bodyClasses() };
      // Must-find: every part of the way was read.
      expect(body.classes).toContain('antialiased');
      expect(ground.classes).toContain('h-screen');
      expect(between.map((e) => e.tag)).toEqual(expect.arrayContaining(['header', 'div', 'img', 'h1']));
      expect(between.flatMap((e) => e.classes)).toEqual(expect.arrayContaining(['max-w-[1200px]', 'my-3', 'whitespace-nowrap']));
      // Control: each kind of break it names is refused (these strings are in a test file, never scanned into CSS).
      const breaks = [
        'opacity-50', 'brightness-50', 'contrast-125', 'blur-sm', 'filter', 'grayscale', 'invert', 'sepia', 'saturate-50',
        'hue-rotate-90', 'mix-blend-difference', 'hidden', 'invisible', 'sr-only', 'collapse', 'text-shadow-lg',
        '[color:white]', '*:text-white', '**:opacity-50', '[&_span]:text-white', '[&>span]:opacity-60', 'dark:brightness-50',
      ];
      const probe = (classes: string[], kind: Kind, tag = 'div') => refused({ tag, classes }, kind);
      expect(probe(breaks, 'body')).toEqual(breaks);
      expect(probe(['text-white', 'bg-white', 'text-2xl', 'md:text-[2.1rem]'], 'between')).toEqual(['text-white', 'bg-white']);
      expect(probe(['text-white', 'bg-white'], 'ground')).toEqual(['text-white']);
      expect(probe(['text-black', 'bg-gray-50'], 'body')).toEqual([]);
      expect(probe(['hidden', 'opacity-50', '[&~h1_span]:text-white'], 'between', 'img')).toEqual(['[&~h1_span]:text-white']);
      // The way itself.
      const found = [
        ...refused(body, 'body').map((c) => `body: ${c}`),
        ...refused(ground, 'ground').map((c) => `ground ${ground.tag}: ${c}`),
        ...between.flatMap((e) => refused(e, 'between').map((c) => `${e.tag}: ${c}`)),
      ];
      expect(found).toEqual([]);
      // No inline style on the way: an inline colour, text fill or filter would reach the spans, unread by the above.
      expect(`${shellStretch()}${headerStretch()}`).not.toMatch(/\sstyle=/);
    }
  );

  it("T9 the bar's premise: the <h1> is bold and never under 24 px at any width, so the title is large text at every width", () => {
    // Every size class is read, whatever its variant (`md:`, `max-sm:`, `min-[…]:`), named or arbitrary px / rem; a
    // `text-` class it cannot size fails here rather than going unread.
    const h1 = h1Classes();
    expect(h1).toContain('font-bold');
    const sizes = sizesPx(h1);
    expect(sizes.map((s) => s.cls)).toContain('text-2xl');
    for (const s of sizes) expect(s.px, s.cls).toBeGreaterThanOrEqual(24);
    // Control: the reader sizes the shapes it must, and refuses one it cannot.
    expect(sizesPx(['md:text-[21px]', 'max-sm:text-base', 'min-[700px]:text-[1.5rem]', 'text-white/50']).map((s) => s.px)).toEqual([21, 16, 24]);
    expect(() => sizesPx(['text-[length:var(--x)]'])).toThrow(/cannot read/);
  });

  for (const [id, theme] of [['T10', 'light'], ['T11', 'dark']] as const) {
    it(`${id} ${theme}: every point of the ramp meets ${BAR} : 1 on the page, in Oklab and in sRGB`, () => {
      for (const span of censused()) {
        const [from, to] = endsOf(span.classes)[theme];
        for (const space of ['oklab', 'srgb'] as const) {
          const w = weakest(from, to, PREMISE[theme], space);
          expect(w, `${span.text} ${theme} ${from} → ${to} on ${PREMISE[theme]} (${space}): ${trunc(w)}`).toBeGreaterThanOrEqual(BAR);
        }
      }
    });
  }

  it("T12 falls back to the page's own solid text colours in print and under prefers-contrast: more", () => {
    // The fallbacks repeat the body's text colours (layout.tsx), so they cannot drift from them.
    const body = bodyClasses();
    const nearBlack = colorToken(body, 'text-');
    const nearWhite = colorToken(body, 'dark:text-');
    for (const span of censused()) {
      expect(span.classes, span.text).toEqual(
        expect.arrayContaining([
          'print:bg-none',
          `print:text-${nearBlack}`,
          'contrast-more:bg-none',
          `contrast-more:text-${nearBlack}`,
          `dark:contrast-more:text-${nearWhite}`,
        ])
      );
    }
    expect(contrast(themeColor(nearBlack), PREMISE.light)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(themeColor(nearWhite), PREMISE.dark)).toBeGreaterThanOrEqual(4.5);
  });

  it('T13 compiled, every class produces CSS, print beats increased contrast, and nothing is !important (W1)', async () => {
    // A print also matches prefers-contrast: more on a computer set to more contrast. Outside `dark:` the title's
    // rules are single classes, so they tie in specificity and the LAST one wins: print must be emitted last. An
    // arbitrary variant (`[@media(…)]:`) compiles after print:, and `!important` wins whatever the order. `dark:`
    // weighs more (`:is(.dark *)`) but sits in `@media not print`, so it never reaches paper (O31).
    for (const classes of new Set(censused().map((s) => s.classes.join(' ')))) {
      const list = classes.split(' ');
      const css = await compileGlobals(list);
      const at = (c: string) => ruleAt(css, c);
      expect(list.filter((c) => at(c) < 0), 'classes with no CSS of their own').toEqual([]);
      for (const c of list) {
        const { selector, block } = ruleBlock(css, at(c));
        expect(block, `${c} is !important`).not.toMatch(/!important/);
        if (c.split(':').includes('dark')) {
          expect(enclosingAt(css, at(c)), `${c} outside print`).toContain('@media not print');
        } else {
          expect(selector, `${c}: one class, so order decides`).toBe(selectorOf(c));
        }
      }
      const printText = need(list.find((c) => c.startsWith('print:text-')), 'print:text-…');
      for (const c of list.filter((x) => /(?:^|:)!?text-/.test(x) && x !== printText)) {
        expect(at(printText), `${printText} after ${c}`).toBeGreaterThan(at(c));
      }
      for (const c of list.filter((x) => /(?:^|:)!?bg-(?:gradient|none)/.test(x) && x !== 'print:bg-none')) {
        expect(at('print:bg-none'), `print:bg-none after ${c}`).toBeGreaterThan(at(c));
      }
      expect(at('contrast-more:bg-none')).toBeGreaterThan(at('bg-gradient-to-r'));
      expect(at('contrast-more:text-black')).toBeGreaterThan(at('text-transparent'));
    }
  }, 60_000);

  it('T14 the <h1> and its ® keep exactly their classes, as T2 pins the words', () => {
    // A class on the <h1> reaches the words from outside their own string: a child variant colouring them, a filter, a
    // blend, a fade, `hidden` below a width, a size (HDR26 review of PR #112, -01). The ® sits beside "CFD", so a
    // sibling variant there (`[&~span]:…`) would reach it. A deliberate change moves these pins, and T8–T9 still apply.
    expect(h1Classes()).toEqual(['text-2xl', 'sm:text-[1.75rem]', 'md:text-[2.1rem]', 'leading-[normal]', 'whitespace-nowrap', 'font-bold']);
    const mark = need(titleSpans(read(HEADER)).find((s) => s.text === '®'), 'the ® span');
    expect(mark.classes).toEqual(['text-gray-400', 'dark:text-gray-500', 'font-normal', 'text-base', 'sm:text-lg', 'align-top']);
  });

  it("T15 globals.css adds no rule of its own that selects the title: only its five named rules, none naming header, h1 or span", async () => {
    // An unlayered rule in globals.css beats every utility whatever its specificity: `header h1 > span { color: inherit }`
    // would turn the title solid with every class above unchanged (review -01, M8). Tailwind's own rules (preflight,
    // the theme) are set aside by compiling Tailwind alone; what is left is CFD's. Not seen: an inline style (T8 refuses
    // them on the way), and any other style sheet (CFD has none).
    const tailwind = rulesIn(await compileCss('@import "tailwindcss";', []));
    const tailwindPaths = new Set(tailwind.map((r) => r.path));
    const ownRules = async (css: string) => rulesIn(await compileCss(css, [])).filter((r) => !tailwindPaths.has(r.path));
    // Must-find, and Tailwind's own rules that name the title's elements, named: preflight's headings rule only.
    expect(tailwind.filter((r) => NAMES_TITLE.test(r.selector)).map((r) => r.path)).toEqual(['@layer base » h1, h2, h3, h4, h5, h6']);
    // Control: the review's M8, added to the real file here in memory, is seen.
    const m8 = await ownRules(`${read(GLOBALS)}\nheader h1 > span { color: inherit }\n`);
    expect(m8.filter((r) => NAMES_TITLE.test(r.selector)).map((r) => r.selector)).toEqual(['header h1 > span']);
    // The file itself.
    const own = await ownRules(read(GLOBALS));
    expect(own.filter((r) => NAMES_TITLE.test(r.selector)).map((r) => r.path), 'a rule of its own naming header, h1 or span').toEqual([]);
    // And every rule of its own, by name: a new one (`.text-transparent { … }`, `* { … }`) fails here until it is read
    // for whether it can reach the title, and listed.
    expect(own.map((r) => r.path)).toEqual([
      '@media not print » html.dark',
      '@layer base » @media not print » :where(.dark) *',
      '@media not print » .recharts-cartesian-axis-line:is(.dark *)',
      '@media not print » .recharts-cartesian-axis-tick-value:is(.dark *)',
      '@media not print » .recharts-brush > rect:first-of-type:is(.dark *)',
    ]);
  }, 60_000);
});
