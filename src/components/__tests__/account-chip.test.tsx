// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// N5 (FRAME26, v0.22.0; stage 0 item 2): the account chip is the frame's `.sf-chip`, its state on the left and its
// action on the right, in its three states, with its names unchanged. Its colours are the frame's tokens, so no
// inline colour and no colour utility on the segments: "Local only" was gray-400 (2.60 on white) and "Sign in" was
// #0070f3 (3.90 on #101828). While the app loads, Cloud Storage cannot open (it needs the project list), so the chip
// is announced as unavailable with aria-disabled (Orch-FRAME-2's D6), stays focusable, and a click does nothing.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ user: null as null | { displayName: string; email: string }, mode: 'local' as 'local' | 'cloud' }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/contexts/storage-context', () => ({ useStorage: () => ({ mode: h.mode }) }));

import { AppHeader } from '../app-header';

const FRAME = readFileSync(join(process.cwd(), 'src', 'styles', 'spert-frame.css'), 'utf8');
const tokens = (selector: string) => {
  const body = FRAME.split(selector + ' {')[1]!.split('}')[0]!;
  const get = (name: string) => new RegExp(`${name}:\\s*(#[0-9a-f]{6})`).exec(body)![1]!;
  return { page: get('--sf-page'), hover: get('--sf-hover'), muted: get('--sf-text-muted'), link: get('--sf-link') };
};
const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (x: string) => { const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(x.slice(i, i + 2), 16))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const COLOUR_UTILITY = /(?:^|:)(?:text|bg|border|fill|stroke)-(?:\[#|white|black|gray|slate|blue|zinc|neutral)/;

function mount(accountUnavailable = false) {
  const onOpenModal = vi.fn();
  const view = render(<AppHeader onNavigateHome={vi.fn()} onOpenModal={onOpenModal} accountUnavailable={accountUnavailable} />);
  const chip = view.container.querySelector('[data-sf="chip"]') as HTMLButtonElement;
  return { chip, onOpenModal, ...view };
}

/** Everything in a segment that could carry a colour of its own: classes, inline styles, SVG paint. */
function ownColours(el: Element): string[] {
  const out: string[] = [];
  for (const e of [el, ...el.querySelectorAll('*')]) {
    for (const c of e.classList) if (COLOUR_UTILITY.test(c)) out.push(c);
    const style = e.getAttribute('style') ?? '';
    if (/color/i.test(style)) out.push(style);
    for (const a of ['fill', 'stroke']) { const v = e.getAttribute(a); if (v && v !== 'none' && v !== 'currentColor') out.push(`${a}=${v}`); }
  }
  return out;
}

beforeEach(() => { h.user = null; h.mode = 'local'; });

describe('the account chip (FRAME26)', () => {
  it('signed out: "Local only" with the lock, then "Sign in", named "Sign in", in the frame\'s segments', () => {
    const { chip } = mount();
    expect(chip).toBe(screen.getByRole('button', { name: 'Sign in' }));
    expect(chip.className).toBe('sf-chip');
    expect(chip.hasAttribute('style')).toBe(false);
    const [state, act] = [...chip.children];
    expect(state.className).toBe('sf-chip-state');
    expect(state.textContent).toBe('Local only');
    expect(state.querySelector('svg')).toBeTruthy();
    expect(act.className).toBe('sf-chip-act');
    expect(act.textContent).toBe('Sign in');
    expect(ownColours(chip)).toEqual([]);
  });

  it('signed in, cloud: the initial and first name, then the cloud in the link colour, named "Account menu"', () => {
    h.user = { displayName: 'Ada Lovelace', email: 'ada@example.com' };
    h.mode = 'cloud';
    const { chip } = mount();
    expect(chip).toBe(screen.getByRole('button', { name: 'Account menu' }));
    expect(chip.getAttribute('aria-haspopup')).toBe('dialog');
    const [state, act] = [...chip.children];
    expect(state.className).toBe('sf-chip-state');
    expect(state.textContent).toBe('AAda');
    expect(act.className).toBe('sf-chip-act');
    expect(act.querySelector('path')!.getAttribute('fill')).toBe('currentColor');
    expect(ownColours(act)).toEqual([]);
  });

  it('signed in, local: the lock in the muted colour, by token, never a fixed one', () => {
    h.user = { displayName: 'Ada Lovelace', email: 'ada@example.com' };
    const { chip } = mount();
    expect(chip.getAttribute('aria-label')).toBe('Account menu');
    const act = chip.querySelector('.sf-chip-act')!;
    expect(act.querySelector('rect')!.getAttribute('stroke')).toBe('currentColor');
    expect(act.firstElementChild!.className).toBe('flex text-(--sf-text-muted)');
  });

  it('every chip text and icon meets its bar at rest and on the hover ground, in both themes', () => {
    for (const sel of [':root', ':root.dark, :root[data-theme="dark"]']) {
      const t = tokens(sel);
      for (const ground of [t.page, t.hover]) {
        expect(contrast(t.muted, ground), `${sel} muted on ${ground}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.link, ground), `${sel} link on ${ground}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    // Control: the old "Local only" on white fails.
    expect(contrast('#99a1af', '#ffffff')).toBeLessThan(4.5);
  });

  it('a click opens Cloud Storage once the app has loaded', () => {
    const { chip, onOpenModal } = mount(false);
    expect(chip.hasAttribute('aria-disabled')).toBe(false);
    fireEvent.click(chip);
    expect(onOpenModal).toHaveBeenCalledTimes(1);
  });

  it('while loading: aria-disabled, still focusable and not disabled, its look at rest, and a click does nothing', () => {
    const { chip, onOpenModal } = mount(true);
    expect(chip.getAttribute('aria-disabled')).toBe('true');
    expect(chip.disabled).toBe(false);
    expect(chip.className).toBe('sf-chip');
    chip.focus();
    expect(document.activeElement).toBe(chip);
    fireEvent.click(chip);
    expect(onOpenModal).not.toHaveBeenCalled();
  });
});
