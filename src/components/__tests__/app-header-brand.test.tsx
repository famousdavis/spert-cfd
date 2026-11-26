// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// N7 (FRAME26, v0.22.0; contract §3 "Brand link"): the brand is one link to the collection, named by its visible
// title, with no aria-label (WCAG 2.5.3); both favicons are decorative. A plain click shows Projects itself; a
// modified or middle click is left to the browser, which opens "/" in a new tab.

import { describe, it, expect, vi } from 'vitest';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/contexts/storage-context', () => ({ useStorage: () => ({ mode: 'local' }) }));

import { AppHeader } from '../app-header';

function mount() {
  const onNavigateHome = vi.fn();
  const view = render(<AppHeader onNavigateHome={onNavigateHome} onOpenModal={vi.fn()} />);
  const brand = screen.getByRole('link', { name: 'SPERT® CFD' });
  return { onNavigateHome, brand, ...view };
}

describe('the brand (FRAME26)', () => {
  it('is an <a href="/"> holding both favicons and the title, hooked, with no aria-label', () => {
    const { brand } = mount();
    expect(brand.tagName).toBe('A');
    expect(brand.getAttribute('href')).toBe('/');
    expect(brand.getAttribute('data-sf')).toBe('brand');
    expect(brand.className).toBe('sf-brand');
    expect(brand.hasAttribute('aria-label')).toBe(false);
    expect(brand.hasAttribute('aria-labelledby')).toBe(false);
    expect(brand.querySelector('[data-sf="title"]')?.textContent).toBe('SPERT® CFD');
  });

  it('shows the light and the dark favicon, both decorative (alt=""), switched by the stylesheet', () => {
    const { brand } = mount();
    const icons = [...brand.querySelectorAll('img')];
    expect(icons.map((i) => [i.getAttribute('src'), i.getAttribute('alt'), i.className, i.getAttribute('data-sf')])).toEqual([
      ['/spert-favicon-cfd.png', '', 'sf-icon sf-icon--light ring-1 ring-white/20', 'favicon'],
      ['/spert-favicon-cfd-dark.png', '', 'sf-icon sf-icon--dark ring-1 ring-white/20', 'favicon'],
    ]);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('the header holds no heading, and its tagline is the frame\'s', () => {
    const { container } = mount();
    expect(screen.queryByRole('heading')).toBeNull();
    const tagline = container.querySelector('[data-sf="tagline"]')!;
    expect(tagline.className).toBe('sf-tagline');
    expect(tagline.textContent).toBe('Cumulative Flow Diagram tool for agile teams');
    expect(container.querySelector('header')!.className).toBe('sf-bar');
  });

  it('a plain click shows Projects itself, and stops the link from navigating', () => {
    const { brand, onNavigateHome } = mount();
    const click = createEvent.click(brand, { button: 0 });
    fireEvent(brand, click);
    expect(onNavigateHome).toHaveBeenCalledTimes(1);
    expect(click.defaultPrevented).toBe(true);
  });

  for (const [what, init] of [
    ['meta', { button: 0, metaKey: true }],
    ['ctrl', { button: 0, ctrlKey: true }],
    ['shift', { button: 0, shiftKey: true }],
    ['alt', { button: 0, altKey: true }],
    ['middle', { button: 1 }],
  ] as const) {
    it(`a ${what} click is left to the browser`, () => {
      const { brand, onNavigateHome } = mount();
      const click = createEvent.click(brand, init);
      fireEvent(brand, click);
      expect(onNavigateHome).not.toHaveBeenCalled();
    });
  }
});
