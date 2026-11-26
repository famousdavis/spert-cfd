// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// N2 (FRAME26, v0.22.0): the navigation row's zones, order, current item and hooks (contract §3, "Navigation zones"
// and "Active item"). The look is the frame's (`.sf-tab`, drawn from aria-current); frame-check measures it.

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TabNavigation, type TabId } from '../tab-navigation';

const ALL: TabId[] = ['projects', 'cfd', 'settings', 'about'];
const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

function bar(active: TabId | null) {
  const onTabChange = vi.fn();
  const view = render(<TabNavigation activeTab={active} onTabChange={onTabChange} />);
  const nav = view.container.querySelector('nav')!;
  return { nav, onTabChange, ...view };
}

describe('the navigation row (FRAME26)', () => {
  it('is the frame\'s nav, with the work zone (Projects · CFD) on the left and Settings · About · Help Center on the right', () => {
    const { nav } = bar('projects');
    expect(nav.getAttribute('data-sf')).toBe('nav');
    expect(nav.className).toBe('sf-nav');
    const row = nav.firstElementChild!;
    expect(row.className).toBe('sf-col sf-nav-row');
    const [work, app] = [...row.children];
    expect(work.getAttribute('data-sf')).toBe('nav-work');
    expect(app.getAttribute('data-sf')).toBe('nav-app');
    expect([...work.children].map(text)).toEqual(['Projects', 'CFD']);
    expect([...app.children].map(text)).toEqual(['Settings', 'About', 'Help Center ↗ (opens in a new tab)']);
    for (const b of nav.querySelectorAll('button')) expect([...b.classList]).toEqual(['sf-tab']);
  });

  for (const active of ALL) {
    it(`marks exactly one item current, with aria-current="page", when ${active} is shown`, () => {
      const { nav } = bar(active);
      const current = [...nav.querySelectorAll('[aria-current]')];
      expect(current).toHaveLength(1);
      expect(current[0].getAttribute('aria-current')).toBe('page');
      expect(current[0].tagName).toBe('BUTTON');
      // "false" is never written: absence is "not current".
      expect(nav.querySelectorAll('[aria-current="false"]')).toHaveLength(0);
    });
  }

  it('marks no item on a screen no item leads to (activeTab null: the changelog, a 404)', () => {
    const { nav } = bar(null);
    expect(nav.querySelectorAll('[aria-current]')).toHaveLength(0);
  });

  it('never marks Help Center, which is the app zone\'s last child and leaves in a new tab', () => {
    for (const active of [...ALL, null]) {
      const { nav, unmount } = bar(active);
      const help = screen.getByRole('link', { name: 'Help Center (opens in a new tab)' });
      expect(help.hasAttribute('aria-current')).toBe(false);
      expect(nav.querySelector('[data-sf="nav-app"]')!.lastElementChild).toBe(help);
      expect(help.className).toBe('sf-help');
      unmount();
    }
  });

  it('keeps today\'s order, so today\'s tab order: Projects, CFD, Settings, About, Help Center', () => {
    const { nav } = bar('cfd');
    expect([...nav.querySelectorAll('button, a')].map(text)).toEqual(['Projects', 'CFD', 'Settings', 'About', 'Help Center ↗ (opens in a new tab)']);
    expect(nav.querySelectorAll('[tabindex]')).toHaveLength(0);
  });

  it('switches with a click (and so with Enter or Space on the focused button)', () => {
    const { onTabChange } = bar('projects');
    fireEvent.click(screen.getByRole('button', { name: 'CFD' }));
    expect(onTabChange).toHaveBeenCalledWith('cfd');
  });
});
