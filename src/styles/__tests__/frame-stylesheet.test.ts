// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * N1 (FRAME26, v0.22.0): the SPERT® Suite frame's stylesheet is vendored BYTE FOR BYTE from
 * spert-suite-docs/suite/frame/spert-frame.css (contract §9.1) and never edited here. Its md5 is pinned, so an edit
 * to the copy turns this red; a new canonical version is re-vendored with `cp` and this pin moves with it, in one PR.
 * It is imported exactly once, by globals.css, unlayered (the frame's rules must beat every Tailwind utility on the
 * same element), and by nothing else.
 */
const SRC = join(process.cwd(), 'src');
const FRAME = join(SRC, 'styles', 'spert-frame.css');
const MD5 = '69146fd77679c71e03d2f06cfea96cf1';
const VERSION = '"2"';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : files(p);
    return /\.(css|tsx?|mjs|js)$/.test(name) ? [p] : [];
  });
}

describe('the vendored frame stylesheet (FRAME26)', () => {
  it(`is byte-identical to the canonical copy: md5 ${MD5}, version ${VERSION}`, () => {
    const bytes = readFileSync(FRAME);
    expect(createHash('md5').update(bytes).digest('hex')).toBe(MD5);
    expect(/--sf-version:\s*("[^"]*")/.exec(bytes.toString('utf8'))?.[1]).toBe(VERSION);
  });

  it('globals.css imports it exactly once, right after tailwindcss and outside any layer', () => {
    const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const imports = [...css.matchAll(/@import\s+"([^"]+)"([^;]*);/g)].map((m) => [m[1], m[2].trim()]);
    expect(imports).toEqual([['tailwindcss', ''], ['../styles/spert-frame.css', '']]);
  });

  it('nothing else in src imports or links it (comments that name it are fine)', () => {
    const others = files(SRC).filter((p) => p !== FRAME && !p.endsWith(join('app', 'globals.css')));
    expect(others.length, 'must-find: the scan reads the source tree').toBeGreaterThan(50);
    expect(others.filter((p) => /(?:\bimport\b[^;'"]*|@import\s+|href=\{?)['"][^'"]*spert-frame\.css/.test(readFileSync(p, 'utf8'))).map((p) => relative(SRC, p))).toEqual([]);
  });
});
