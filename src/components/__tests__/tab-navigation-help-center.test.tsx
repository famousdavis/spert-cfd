// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// Adding a guide to public/? Also add it, with a one-line description, to spertsuite.com's
// src/data/help.ts (spert-landing-page). The landing page's daily "Guide list matches the app
// repos" check stays red until you do. The PDF guide house rules say the same.

// v0.17.8: the Help Center link sits at the right-hand end of the tab bar,
// after About, and opens this app's page in the SPERT® Suite Help Center in a
// new tab. It is a LINK, never a tab.
//
// ⚠️ The address is compared with a LITERAL, never with HELP_CENTER_URL from
// constants.ts: a test that imported the constant would agree with any wrong
// slug written there.
//
// ⚠️ The "not a tab" tests count EVERY <button> and EVERY aria-current in the
// bar. The app-shell tests find tabs by name only, so a fifth tab with another
// label, or the link turned into a tab, leaves them all green.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TabNavigation, type TabId } from '../tab-navigation';

const TAB_LABELS_IN_ORDER = ['Projects', 'CFD', 'Settings', 'About'];
const ALL_TABS: TabId[] = ['projects', 'cfd', 'settings', 'about'];
const ACCESSIBLE_NAME = 'Help Center (opens in a new tab)';

function renderBar(activeTab: TabId = 'projects') {
  const { container, unmount } = render(
    <TabNavigation activeTab={activeTab} onTabChange={vi.fn()} />
  );
  const nav = container.querySelector('nav') as HTMLElement;
  const bar = nav.firstElementChild as HTMLElement;
  const link = screen.getByRole('link', { name: ACCESSIBLE_NAME });
  return { bar, link, unmount };
}

describe('TabNavigation: the Help Center link', () => {
  it('points at this app’s Help Center page, exactly', () => {
    const { link } = renderBar();
    expect(link.getAttribute('href')).toBe('https://spertsuite.com/help/cfd');
  });

  it('opens in a new tab, without handing the opener or the referrer to it', () => {
    const { link } = renderBar();
    expect(link.getAttribute('target')).toBe('_blank');
    const rel = (link.getAttribute('rel') ?? '').split(/\s+/);
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  it('is named "Help Center (opens in a new tab)", with the arrow hidden and the note visually hidden', () => {
    const { link } = renderBar();
    // getByRole above matched the whole accessible name; these pin its parts.
    // jsdom applies no CSS, so a VISIBLE "(opens in a new tab)" would pass the
    // name check: the sr-only class is what keeps it off the screen.
    const arrow = link.querySelector('[aria-hidden="true"]');
    expect(arrow?.textContent).toBe('↗');
    const hidden = [...link.querySelectorAll('span')].find(
      (s) => s.textContent === '(opens in a new tab)'
    );
    expect(hidden, 'the "(opens in a new tab)" span').toBeDefined();
    expect(hidden!.classList.contains('sr-only')).toBe(true);
    expect(hidden!.hasAttribute('aria-hidden')).toBe(false);
  });

  // Every active tab, not one: the link must not move when the tabs change.
  for (const active of ALL_TABS) {
    it(`sits directly after About, as the bar's last child, with ${active} active`, () => {
      const { bar, link } = renderBar(active);
      expect(link.parentElement).toBe(bar);
      expect(bar.lastElementChild).toBe(link);
      const before = link.previousElementSibling;
      expect(before?.tagName).toBe('BUTTON');
      expect(before?.textContent).toBe('About');
    });
  }
});

describe('TabNavigation: the Help Center link is not a tab', () => {
  // v0.17.9: the tab look is READ FROM THE RENDERED ACTIVE TAB, never listed
  // here. v0.17.8 asserted the link lacked `rounded-full` and `bg-blue-600`,
  // the old pill's classes; once the tabs were restyled those two assertions
  // passed whatever the link looked like, even with the active tab's classes
  // pasted onto it (measured). "Look" is the shape and fill: every rounded*,
  // bg-*, border*, px-* and py-* class. Typography is left out on purpose:
  // the link and the tabs may share a text size. The must-find keeps the
  // check from passing on a tab that has no look to compare.
  for (const active of ALL_TABS) {
    it(`is a plain <a>, with no role and none of the active tab's shape or fill, with ${active} active`, () => {
      const { bar, link } = renderBar(active);
      expect(link.tagName).toBe('A');
      expect(link.hasAttribute('role')).toBe(false);
      const tab = bar.querySelector('[aria-current]') as HTMLElement;
      const look = [...tab.classList].filter((c) => /^(rounded|bg-|border|px-|py-)/.test(c));
      expect(look.some((c) => c.startsWith('rounded')), 'must-find: a rounded* class on the active tab').toBe(true);
      expect(look.some((c) => c.startsWith('bg-')), 'must-find: a bg-* class on the active tab').toBe(true);
      expect(look.some((c) => c.startsWith('border')), 'must-find: a border* class on the active tab').toBe(true);
      expect(look.filter((c) => link.classList.contains(c))).toEqual([]);
    });
  }

  it('leaves exactly four buttons in the bar, the four tabs, in order', () => {
    const { bar } = renderBar();
    const labels = [...bar.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toEqual(TAB_LABELS_IN_ORDER);
  });

  it('never carries aria-current, and exactly one element in the bar does, whichever tab is active', () => {
    for (const active of ALL_TABS) {
      const { bar, link, unmount } = renderBar(active);
      expect(link.hasAttribute('aria-current'), `activeTab=${active}`).toBe(false);
      const current = bar.querySelectorAll('[aria-current]');
      expect(current.length, `activeTab=${active}`).toBe(1);
      expect(current[0].tagName, `activeTab=${active}`).toBe('BUTTON');
      unmount();
    }
  });

  it('sets no tabindex in the bar, so Tab visits the four tabs and then the link', () => {
    const { bar } = renderBar();
    expect(bar.querySelectorAll('[tabindex]').length).toBe(0);
  });
});
