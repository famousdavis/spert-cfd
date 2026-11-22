// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { compile } from 'tailwindcss';
import { setSystemDark } from '../../__tests__/match-media';

/**
 * The header's theme switch (v0.20.0, DASH26 RD2): SPERT® Forecaster's
 * HeaderThemeToggle over CFD's store. Its first render shows the stored
 * preference (no placeholder on the client); each click moves System → Light →
 * Dark → System, changes the page and says so in a status line; a refused or
 * unreadable storage never stops it (O34). The placeholder exists only in a
 * server render; its colours are checked as compiled CSS, since jsdom applies
 * no Tailwind.
 */

const isDark = () => document.documentElement.classList.contains('dark');

async function mountFresh() {
  vi.resetModules(); // a fresh store, as on a page load
  const { HeaderThemeToggle } = await import('../theme-toggle');
  return { view: render(<HeaderThemeToggle />), HeaderThemeToggle };
}

const button = () => screen.getByRole('button');
const statusText = () => screen.getByRole('status').textContent;
/** The shown icon, told apart by its shape: the sun's circle, the moon's path, the monitor's rect. */
const icon = () => {
  const svg = button().querySelector('svg')!;
  if (svg.querySelector('circle')) return 'sun';
  if (svg.querySelector('rect')) return 'monitor';
  if (svg.querySelector('path')) return 'moon';
  return 'none';
};

function quotaError(): Error {
  const e = new Error('The quota has been exceeded.');
  e.name = 'QuotaExceededError';
  return e;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the switch’s first render shows the stored preference', () => {
  it.each([
    [null, 'System', 'Light', 'monitor'],
    ['system', 'System', 'Light', 'monitor'],
    ['light', 'Light', 'Dark', 'sun'],
    ['dark', 'Dark', 'System', 'moon'],
    ['blue', 'System', 'Light', 'monitor'],
  ])('stored %j: %s, its icon and label, no placeholder', async (stored, label, next, shape) => {
    if (stored !== null) localStorage.setItem('spert-theme', stored);
    const { view } = await mountFresh();
    expect(button().getAttribute('aria-label')).toBe(`Theme: ${label}. Switch to ${next}`);
    expect(button().getAttribute('title')).toBe(`Theme: ${label}`);
    expect(button().getAttribute('type')).toBe('button');
    expect(icon()).toBe(shape);
    expect(view.container.querySelector('div.h-8')).toBeNull();
  });
});

describe('the switch\'s look and its status line (PR #111 review -06)', () => {
  it('is faint at rest, full on hover and full while focused by keyboard (O39); its status line is hidden and polite (O38)', async () => {
    await mountFresh();
    const classes = button().classList;
    expect(classes.contains('opacity-70'), 'opacity-70 at rest').toBe(true);
    expect(classes.contains('hover:opacity-100'), 'hover:opacity-100').toBe(true);
    expect(classes.contains('focus-visible:opacity-100'), 'focus-visible:opacity-100 (O39)').toBe(true);
    const status = screen.getByRole('status');
    expect(status.classList.contains('sr-only'), 'the status line takes no space and shows nothing').toBe(true);
    expect(status.getAttribute('aria-live')).toBe('polite');
  });
});

describe('a click', () => {
  it('cycles System → Light → Dark → System: icon, label, title, the page, the stored value and the announcement', async () => {
    setSystemDark(true);
    await mountFresh();
    expect(statusText()).toBe('');

    fireEvent.click(button());
    expect(button().getAttribute('aria-label')).toBe('Theme: Light. Switch to Dark');
    expect(button().getAttribute('title')).toBe('Theme: Light');
    expect(icon()).toBe('sun');
    expect(isDark()).toBe(false);
    expect(localStorage.getItem('spert-theme')).toBe('light');
    expect(statusText()).toBe('Theme: Light');

    fireEvent.click(button());
    expect(button().getAttribute('aria-label')).toBe('Theme: Dark. Switch to System');
    expect(icon()).toBe('moon');
    expect(isDark()).toBe(true);
    expect(localStorage.getItem('spert-theme')).toBe('dark');
    expect(statusText()).toBe('Theme: Dark');

    fireEvent.click(button());
    expect(button().getAttribute('aria-label')).toBe('Theme: System. Switch to Light');
    expect(icon()).toBe('monitor');
    expect(isDark()).toBe(true);
    expect(localStorage.getItem('spert-theme')).toBe('system');
    expect(statusText()).toBe('Theme: System (dark)');
  });

  it('announces System with the computer’s current setting', async () => {
    localStorage.setItem('spert-theme', 'dark');
    setSystemDark(false);
    await mountFresh();
    fireEvent.click(button());
    expect(statusText()).toBe('Theme: System (light)');
    expect(isDark()).toBe(false);
  });

  it('with the save refused (storage full): nothing thrown; icon, label, announcement and page agree; the stored value stays', async () => {
    localStorage.setItem('spert-theme', 'light');
    await mountFresh();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaError();
    });
    expect(() => fireEvent.click(button())).not.toThrow();
    expect(button().getAttribute('aria-label')).toBe('Theme: Dark. Switch to System');
    expect(icon()).toBe('moon');
    expect(statusText()).toBe('Theme: Dark');
    expect(isDark()).toBe(true);
    vi.restoreAllMocks();
    expect(localStorage.getItem('spert-theme')).toBe('light');
  });

  it('with its own read throwing (getItem for spert-theme): System first, and the click still moves on', async () => {
    const realGet = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === 'spert-theme') throw new Error('denied');
      return realGet.call(this, key);
    });
    await mountFresh();
    expect(button().getAttribute('aria-label')).toBe('Theme: System. Switch to Light');
    fireEvent.click(button());
    expect(button().getAttribute('aria-label')).toBe('Theme: Light. Switch to Dark');
    expect(statusText()).toBe('Theme: Light');
    expect(isDark()).toBe(false);
  });
});

// ── The placeholder: a server render, measured as the CSS its classes compile to ──

const APP = join(process.cwd(), 'src', 'app');
const resolveCss = createRequire(join(APP, 'globals.css')).resolve;

async function compileClasses(classes: string[]): Promise<string> {
  const css = readFileSync(join(APP, 'globals.css'), 'utf8');
  const compiler = await compile(css, {
    base: APP,
    loadStylesheet: async (id: string) => {
      if (id !== 'tailwindcss') throw new Error(`unexpected @import ${id}`);
      const path = resolveCss('tailwindcss/index.css');
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
    },
  });
  return compiler.build(classes);
}

/** `prop`'s value in the rule for `selector` (exactly), or null. */
function declared(css: string, selector: string, prop: string): string | null {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) return null;
  const body = css.slice(at, css.indexOf('}', at));
  const m = body.match(new RegExp(`(?:^|[;{\\s])${prop}:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

/** A `var(--x)` resolved through the compiled theme's custom properties. */
function resolveVar(css: string, value: string): string {
  return value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
    const m = css.match(new RegExp(`${name}:\\s*([^;]+);`));
    return m ? m[1].trim() : 'UNDEFINED';
  });
}

function isPaint(colour: string): boolean {
  return !/UNDEFINED|transparent|\/\s*0\)|rgba?\([^)]*,\s*0\)/.test(colour) && colour.length > 0;
}

/** `calc(var(--spacing) * 8)` with --spacing 0.25rem → 2 (rem). */
function rem(css: string, value: string): number {
  const v = resolveVar(css, value);
  const m = v.match(/^calc\(\s*([\d.]+)rem\s*\*\s*([\d.]+)\s*\)$/) || v.match(/^calc\(\s*([\d.]+)\s*\*\s*([\d.]+)rem\s*\)$/);
  if (m) return parseFloat(m[1]) * parseFloat(m[2]);
  const r = v.match(/^([\d.]+)rem$/);
  return r ? parseFloat(r[1]) : NaN;
}

describe('the placeholder (server render only)', () => {
  it('is what the server renders, with the status line; the client never shows it', async () => {
    vi.resetModules();
    const { HeaderThemeToggle } = await import('../theme-toggle');
    const html = renderToString(<HeaderThemeToggle />);
    expect(html).not.toContain('<button');
    expect(html).toMatch(/<div class="[^"]+"><\/div>/);
    expect(html).toContain('role="status"');
  });

  it('is a 2 rem (32 px) square with a background in light and its own in dark, as compiled by the app’s Tailwind', async () => {
    vi.resetModules();
    const { HeaderThemeToggle } = await import('../theme-toggle');
    const html = renderToString(<HeaderThemeToggle />);
    const classes = html.match(/<div class="([^"]+)"><\/div>/)![1].split(/\s+/);
    const css = await compileClasses(classes);

    const esc = (c: string) => '.' + c.replace(/[:/[\]#.()%]/g, (ch) => `\\${ch}`);
    const sizes = { height: NaN, width: NaN };
    let lightBg: string | null = null;
    let darkBg: string | null = null;
    for (const c of classes) {
      const sel = esc(c);
      const h = declared(css, sel, 'height');
      const w = declared(css, sel, 'width');
      if (h) sizes.height = rem(css, h);
      if (w) sizes.width = rem(css, w);
      if (c.startsWith('dark:')) {
        const bg = declared(css, `${sel}:is(.dark *)`, 'background-color');
        if (bg) darkBg = resolveVar(css, bg);
      } else {
        const bg = declared(css, sel, 'background-color');
        if (bg) lightBg = resolveVar(css, bg);
      }
    }
    expect(sizes).toEqual({ height: 2, width: 2 });
    expect(lightBg, 'a light background').not.toBeNull();
    expect(isPaint(lightBg!), `light background ${lightBg}`).toBe(true);
    expect(darkBg, 'a dark background under the dark class').not.toBeNull();
    expect(isPaint(darkBg!), `dark background ${darkBg}`).toBe(true);
    expect(darkBg).not.toBe(lightBg);
  });
});
