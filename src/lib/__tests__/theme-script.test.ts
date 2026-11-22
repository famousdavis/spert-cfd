// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * One rule in two places (v0.20.0, DASH26 RD2, O33). The pre-paint script in
 * `<head>` and the store that the switch and ThemeSync use must agree on every
 * stored value: anything but light, dark or system — missing, invalid or
 * unreadable — means System, and System follows the computer.
 *
 * This runs the script's own text, `THEME_SCRIPT` as layout.tsx writes it (not
 * a copy of its logic), in a fresh JavaScript context with a stand-in window
 * and document, for each stored value against both settings of the computer;
 * then it asks the store the same question with the same stand-ins. Storage
 * that cannot be read comes in the two shapes a browser has: `getItem`
 * throwing, and the `window.localStorage` getter itself throwing (Chrome with
 * site data blocked).
 */

type Stored =
  | { kind: 'none' }
  | { kind: 'value'; value: string }
  | { kind: 'getItem-throws' }
  | { kind: 'getter-throws' };

const CASES: Array<[string, Stored, { lightComputer: boolean; darkComputer: boolean }]> = [
  ['nothing stored', { kind: 'none' }, { lightComputer: false, darkComputer: true }],
  ['light', { kind: 'value', value: 'light' }, { lightComputer: false, darkComputer: false }],
  ['dark', { kind: 'value', value: 'dark' }, { lightComputer: true, darkComputer: true }],
  ['system', { kind: 'value', value: 'system' }, { lightComputer: false, darkComputer: true }],
  ['an invalid value ("blue")', { kind: 'value', value: 'blue' }, { lightComputer: false, darkComputer: true }],
  ['getItem throwing', { kind: 'getItem-throws' }, { lightComputer: false, darkComputer: true }],
  ['the localStorage getter throwing', { kind: 'getter-throws' }, { lightComputer: false, darkComputer: true }],
];

function denied(): Error {
  const e = new Error('The operation is insecure.');
  e.name = 'SecurityError';
  return e;
}

/** A window and document with just what the script and the store touch. */
function standIns(stored: Stored, computerDark: boolean) {
  const classes = new Set<string>();
  const storage = {
    getItem(key: string) {
      if (stored.kind === 'getItem-throws') throw denied();
      if (stored.kind === 'value' && key === 'spert-theme') return stored.value;
      return null;
    },
    setItem: vi.fn(),
  };
  const window: Record<string, unknown> = {
    matchMedia: (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' && computerDark,
      addEventListener() {},
      removeEventListener() {},
    }),
  };
  Object.defineProperty(window, 'localStorage', {
    get() {
      if (stored.kind === 'getter-throws') throw denied();
      return storage;
    },
  });
  const document = {
    documentElement: {
      classList: {
        add: (c: string) => void classes.add(c),
        remove: (c: string) => void classes.delete(c),
        toggle: (c: string, force?: boolean) => {
          const on = force ?? !classes.has(c);
          if (on) classes.add(c);
          else classes.delete(c);
          return on;
        },
        contains: (c: string) => classes.has(c),
      },
    },
  };
  return { window, document, classes, storage };
}

async function scriptGivesDark(stored: Stored, computerDark: boolean): Promise<boolean> {
  const { THEME_SCRIPT } = await import('../theme');
  const { window, document, classes } = standIns(stored, computerDark);
  runInNewContext(THEME_SCRIPT, { window, document });
  return classes.has('dark');
}

async function storeGivesDark(stored: Stored, computerDark: boolean): Promise<boolean> {
  const { window, document, classes } = standIns(stored, computerDark);
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', document);
  vi.resetModules(); // a fresh store: its preference is read from storage once
  const theme = await import('../theme');
  theme.applyTheme();
  return classes.has('dark');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the pre-paint script and the store: one rule', () => {
  for (const [name, stored, expected] of CASES) {
    for (const computerDark of [false, true]) {
      const want = computerDark ? expected.darkComputer : expected.lightComputer;
      it(`${name}, computer ${computerDark ? 'dark' : 'light'}: ${want ? 'dark' : 'light'}`, async () => {
        expect(await scriptGivesDark(stored, computerDark), 'the script').toBe(want);
        expect(await storeGivesDark(stored, computerDark), 'the store').toBe(want);
      });
    }
  }

  it('the script reads the store’s key and never writes', async () => {
    const { THEME_SCRIPT, THEME_KEY } = await import('../theme');
    expect(THEME_KEY).toBe('spert-theme');
    const { window, document, storage } = standIns({ kind: 'value', value: 'dark' }, false);
    runInNewContext(THEME_SCRIPT, { window, document });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(THEME_SCRIPT).toContain('"spert-theme"');
  });
});
