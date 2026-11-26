// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// N6 (FRAME26, v0.22.0): the theme button is the frame's 32 × 32 `.sf-theme`, and its icons draw in `currentColor`
// (the frame's muted colour at rest, its text colour on hover), at full opacity: they carry state, so they are held
// to the 3 : 1 non-text bar. Until v0.22.0 the sun was amber #f59e0b (2.15 : 1 on white) and the button 70 % opaque.

import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const FIXED_COLOUR = /^#|^rgb|^hsl/i;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
});

async function mount() {
  const { HeaderThemeToggle } = await import('../theme-toggle');
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<HeaderThemeToggle />); });
  return view;
}

describe('the header theme button (FRAME26)', () => {
  it('is the frame\'s .sf-theme, hooked, with its name and title unchanged', async () => {
    await mount();
    const b = screen.getByRole('button', { name: /^Theme: / });
    expect([...b.classList]).toEqual(['sf-theme']);
    expect(b.getAttribute('data-sf')).toBe('theme');
    expect(b.getAttribute('type')).toBe('button');
    expect(b.getAttribute('title')).toMatch(/^Theme: (System|Light|Dark)$/);
  });

  it('draws every icon of the cycle in currentColor, with no fixed fill or stroke and no opacity, anywhere', async () => {
    await mount();
    const b = () => screen.getByRole('button', { name: /^Theme: / });
    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const svg = b().querySelector('svg')!;
      expect(svg, 'must-find: the icon').toBeTruthy();
      seen.add(b().getAttribute('title')!);
      for (const el of [svg, ...svg.querySelectorAll('*')]) {
        for (const attr of ['fill', 'stroke', 'color', 'opacity', 'fill-opacity', 'stroke-opacity', 'style']) {
          const v = el.getAttribute(attr);
          if (v === null) continue;
          expect(FIXED_COLOUR.test(v) || attr.includes('opacity') || attr === 'style', `${b().getAttribute('title')} <${el.tagName}> ${attr}="${v}"`).toBe(false);
        }
      }
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect([...b().classList].some((c) => c.includes('opacity'))).toBe(false);
      fireEvent.click(b());
    }
    expect(seen.size, 'all three icons were read').toBe(3);
  });
});
