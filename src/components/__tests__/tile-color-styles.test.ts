// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.21.0 (DASH26 R2, O50, P5; PR #115 review, Opus-PR115-2 -03): the tile's tints as a person sees them.
// Each background is computed from its class string (a hex, or `color-mix(in srgb, …)`, which mixes the
// gamma-encoded channels) and must equal the colour P5 measured in Chrome (production build, both themes;
// Meas-DASH-R2 and Opus-PR115-2 read the same hexes). Then what the table means, independent of the pin:
// an archived tint is half its tint over the untinted surface, and the name and meta text clear 4.5:1 on
// every background, in their own theme.
import { describe, it, expect } from 'vitest';
import { PROJECT_COLORS, type ProjectColor } from '@/lib/project-prefs';
import { TILE_TINT, TILE_TINT_ARCHIVED } from '../tile-color-styles';
import { META, NAME_ARCHIVED, NAME_COLOR } from '../dashboard-styles';

type Key = ProjectColor | 'none';
type Theme = 'light' | 'dark';
const KEYS: Key[] = ['none', ...PROJECT_COLORS];

/** Measured (P5, `p5/contrast/`; Opus-PR115-2 `look-measure.json`): computed colours read back through a canvas. */
const MEASURED: Record<Theme, Record<'tint' | 'archived', Record<Key, string>>> = {
  light: {
    tint: { none: 'f9f9f9', blue: 'e0ebfe', teal: 'd9f4f1', slate: 'e6e9ec', purple: 'f1e4fe', pink: 'fce2ef' },
    archived: { none: 'f9f9f9', blue: 'edf2fc', teal: 'e9f7f5', slate: 'f0f1f3', purple: 'f5effc', pink: 'fbeef4' },
  },
  dark: {
    tint: { none: '16213e', blue: '1e3667', teal: '164255', slate: '27334f', purple: '362c67', pink: '452a52' },
    archived: { none: '16213e', blue: '1a2c53', teal: '16324a', slate: '1f2a47', purple: '262753', pink: '2e2648' },
  },
};

const rgb = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (c: number[]) => c.map((v) => v.toString(16).padStart(2, '0')).join('');

/** The colour one `bg-[…]` / `text-[…]` value names: `#rgb`, `#rrggbb`, or `color-mix(in_srgb,#a_P%,#b)`. */
function resolve(value: string): string {
  const short = /^#([0-9a-f]{3})$/i.exec(value);
  if (short) return [...short[1].toLowerCase()].map((c) => c + c).join('');
  const plain = /^#([0-9a-f]{6})$/i.exec(value);
  if (plain) return plain[1].toLowerCase();
  const mix = /^color-mix\(in_srgb,#([0-9a-f]{6})_(\d+)%,#([0-9a-f]{6})\)$/i.exec(value);
  if (!mix) throw new Error(`not a colour this test reads: ${value}`);
  const p = Number(mix[2]) / 100;
  const [a, b] = [rgb(mix[1]), rgb(mix[3])];
  return hex(a.map((v, i) => Math.round(v * p + b[i] * (1 - p))));
}

/** The colour a class string gives `property` in `theme` (the `dark:` one in dark, the plain one in light). */
function colourOf(classes: string, property: 'bg' | 'text', theme: Theme): string {
  const re = new RegExp(`(?:^|\\s)${theme === 'dark' ? 'dark:' : ''}${property}-\\[([^\\]]+)\\]`, 'g');
  // A colour, never a size such as `text-[0.85rem]`.
  const found = [...classes.matchAll(re)].map((m) => m[1]).filter((v) => v.startsWith('#') || v.startsWith('color-mix('));
  expect(found, `${theme} ${property} in "${classes}"`).toHaveLength(1);
  return resolve(found[0]);
}

function luminance(h: string): number {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe.each(['light', 'dark'] as const)('%s', (theme) => {
  it.each(KEYS)('%s: the tint and the archived tint render as measured', (key) => {
    expect(colourOf(TILE_TINT[key], 'bg', theme)).toBe(MEASURED[theme].tint[key]);
    expect(colourOf(TILE_TINT_ARCHIVED[key], 'bg', theme)).toBe(MEASURED[theme].archived[key]);
  });

  it.each(PROJECT_COLORS)('%s: the archived tint is half the tint over the untinted surface (O50)', (key) => {
    const [tint, none, archived] = [TILE_TINT[key], TILE_TINT.none, TILE_TINT_ARCHIVED[key]].map((c) => rgb(colourOf(c, 'bg', theme)));
    for (let i = 0; i < 3; i++) expect(Math.abs(archived[i] - (tint[i] + none[i]) / 2)).toBeLessThanOrEqual(0.5);
    expect(archived).not.toEqual(tint);
  });

  it.each(KEYS)('%s: the name and the meta lines clear 4.5:1 on the tint and the archived tint', (key) => {
    const meta = colourOf(META, 'text', theme);
    for (const [bg, name] of [[TILE_TINT[key], NAME_COLOR], [TILE_TINT_ARCHIVED[key], NAME_ARCHIVED]] as const) {
      const surface = colourOf(bg, 'bg', theme);
      expect(contrast(colourOf(name, 'text', theme), surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(meta, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

it('the reader is not vacuous: a light hex in the dark slot is read as such and fails the contrast', () => {
  expect(colourOf("bg-[#fce2ef] dark:bg-[#fce2ef]", 'bg', 'dark')).toBe('fce2ef');
  expect(contrast(colourOf(NAME_COLOR, 'text', 'dark'), 'fce2ef')).toBeLessThan(4.5);
  expect(resolve('color-mix(in_srgb,#1e3667_50%,#16213e)')).toBe('1a2c53');
});
