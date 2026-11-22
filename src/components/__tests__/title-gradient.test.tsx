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

/** The `<h1>`'s own text, between its spans, as rendered. */
const h1OwnText = () => jsxText(titleH1(read(HEADER)).replace(/^<h1[^>]*>/, '').replace(SPAN, ''));

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

/**
 * Every `className` in a stretch of JSX, in order, as the browser gets it: `"…"`, `{NAME}`, or a template literal
 * whose `${NAME}` parts are resolved. Anything else (an unknown name, a call, a ternary) fails loudly: a class the
 * guard cannot read could paint a ground it cannot see.
 */
function classNamesIn(jsx: string, constants: Map<string, string>): string[][] {
  const out: string[][] = [];
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
    out.push(classList(raw));
  }
  return out;
}

/**
 * The title's ground: app-shell's element that wraps `<AppHeader`, from its last `return (` before it. The first
 * className there paints the ground; any other on the way, and every className in the header from `<header` down
 * to and including the `<h1>`, must not paint a ground of its own or fade it.
 */
function groundChain(): { ground: string[]; between: string[][] } {
  const shell = read(SHELL);
  const at = shell.indexOf('<AppHeader');
  const [ground, ...rest] = classNamesIn(shell.slice(shell.lastIndexOf('return (', at), at), new Map());
  const header = read(HEADER);
  const h1At = header.search(/<h1\s+className=/);
  const h1End = header.indexOf('>', h1At) + 1;
  const inHeader = classNamesIn(header.slice(header.indexOf('<header className='), h1End), headerConstants());
  return { ground: need(ground, "app-shell's wrapper classes"), between: [...rest, ...inHeader] };
}

/** The body's own text colours (layout.tsx), which the title's solid fallbacks repeat. */
function bodyClasses(): string[] {
  const raw = need(/<body\s+className=\{`([^`]*)`\}/.exec(read(LAYOUT))?.[1], 'layout.tsx <body className={`…`}>');
  return classList(raw.replace(/\$\{[^}]*\}/g, ' '));
}

/** A text size class's size in px: `text-2xl` through theme.css, `text-[2.1rem]` from its value. */
function sizePx(cls: string): number {
  const utility = cls.slice(cls.lastIndexOf(':') + 1);
  const arbitrary = /^text-\[([\d.]+)rem\]$/.exec(utility);
  if (arbitrary) return Number(arbitrary[1]) * 16;
  const named = new RegExp(`--${utility}:\\s*([\\d.]+)rem;`).exec(read(THEME_CSS));
  return Number(need(named?.[1], `theme.css --${utility}`)) * 16;
}

// ---- Compiled CSS (CFD's real globals.css, by the app's own Tailwind; globals-css.test.ts's loader) -------------

async function compileGlobals(candidates: string[]): Promise<string> {
  const compiler = await compile(read(GLOBALS), {
    base: dirname(GLOBALS),
    loadStylesheet: async (id: string) => {
      if (id !== 'tailwindcss') throw new Error(`unexpected @import ${id}`);
      const path = resolveFromApp('tailwindcss/index.css');
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
    },
  });
  return compiler.build(candidates);
}

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
    expect(themeColor(colorToken(ground, 'bg-'))).toBe(PREMISE.light);
    expect(themeColor(colorToken(ground, 'dark:bg-'))).toBe(PREMISE.dark);
  });

  it('T8 nothing between that page and the title paints a ground of its own or fades it', () => {
    // The wrapper is the title's ground only while nothing in between paints one, and a fade would sink a ramp
    // that clears the bar by hundredths. Read from what is really there: the <header>'s template literal with
    // PAGE_COLUMN resolved from page-column.ts (must-find below), the inner <div>s, the logo and the <h1> itself.
    const between = groundChain().between.flat();
    expect(between).toEqual(expect.arrayContaining(['max-w-[1200px]', 'my-3', 'whitespace-nowrap']));
    expect(between.filter((c) => /(?:^|:)(?:bg-|opacity-)/.test(c))).toEqual([]);
  });

  it("T9 the bar's premise: the <h1> is bold and never under 24 px, so the title is large text at every width", () => {
    const h1 = h1Classes();
    expect(h1).toContain('font-bold');
    const sizes = h1.filter((c) => /^(?:[a-z]+:)?text-(?:\[[\d.]+rem\]|xs|sm|base|lg|\d?xl)$/.test(c));
    expect(sizes).toContain('text-2xl');
    expect(Math.min(...sizes.map(sizePx)), sizes.join(' ')).toBeGreaterThanOrEqual(24);
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
});
