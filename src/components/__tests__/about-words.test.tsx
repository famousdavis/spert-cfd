// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// FRAME26 pass 3 (v0.24.0): every word on the About page is approved, contract §7's shared words or CFD's own in
// FRAME26-ABOUT-WORDS.md (William, 2026-11-27); Flow metrics is v0.23.0's text word for word. Each paragraph and list
// item is compared with a LITERAL copy here, never with a constant the component imports, so a changed word in either
// place turns this red (Flow metrics' 20 % and 2 × included: they are computed from the panel's constants, so a
// change there shows here). Read as a screen reader gets it minus the "(opens in a new tab)" warnings (`.sf-sr`),
// whitespace collapsed; the visible "↗" stays in.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render } from '@testing-library/react';

import { AboutTab } from '../about-tab';
import { APP_VERSION } from '@/lib/constants';

beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 5, 15)); });
afterAll(() => vi.useRealTimers());

const text = (el: Element) => {
  const c = el.cloneNode(true) as Element;
  c.querySelectorAll('.sf-sr').forEach((s) => s.remove());
  return (c.textContent ?? '').replace(/\s+/g, ' ').trim();
};

const EXPECTED: [string, string[]][] = [
  ['What is SPERT® CFD?', [
    'SPERT® CFD is a lightweight, browser-based tool for building and analyzing Cumulative Flow Diagrams. CFDs are a standard agile visualization that shows how work items flow through your process over time, making bottlenecks, WIP buildup, and throughput trends visible at a glance.',
  ]],
  ['How it works', [
    'Create a project and define your workflow states (e.g., Backlog, In Dev, Done)',
    'Record daily or periodic snapshots of item counts in each state. Done counts are cumulative: each snapshot counts every item finished so far, without resetting at the end of a sprint.',
    'View the stacked-area CFD chart that updates as you add data',
    'Monitor flow metrics: WIP, throughput, start and arrival rates, and approximate cycle time and lead time',
    'Set WIP limits and get visual warnings when they are exceeded',
  ]],
  ['Flow metrics', [
    "The metrics panel calculates Work in Progress (WIP), throughput (items completed per day), start rate (items starting work per day) and arrival rate (new requests entering the backlog per day). It estimates two times with Little's Law, each the period's average number of items ÷ its throughput:",
    'Cycle time runs from when work on an item first starts until it is done. It averages the items in your active states.',
    'Lead time runs from when a request enters the backlog until it is done, so it includes all the time the request sits in the backlog. It averages the items in your backlog and active states.',
    "The WIP card shows the period's average number of active items, the figure cycle time divides by throughput, with today's count beneath it. The lead time card notes its own average, of backlog and active items.",
    "Keep the Backlog to real requests. Little's Law assumes every item is eventually finished, so a long tail of ideas that will never be done inflates lead time. Rates come from the change in counts, so a request removed without being done cancels out a new one, and if more are removed than arrive, arrival rate shows 0.",
    'Both times assume a steady flow. When work starts more than 20% faster or slower than it finishes, the panel warns that cycle time will understate or overstate how long new work takes; when requests arrive more than 20% faster or slower than they finish, it warns the same of lead time. Because a few items either way is a large share of a small count, it also waits until the gap between the items that started (or arrived) and those that finished is more than 2 × the square root of their sum, wider than chance alone usually explains. If a Done count goes down, the panel warns you of that instead.',
    'Metrics can be filtered by time period: all data, or the last 7, 14, 30 or 90 days. A project imported with another period, such as a custom date range, keeps it, and the panel names it.',
  ]],
  // v0.25.0: the guide row (its title, the Help Center's description verbatim, its open link), then More help.
  ['Guides', [
    'Quick Reference Guide',
    'What CFD is and how it turns your workflow’s daily item counts into a cumulative flow diagram and flow metrics such as WIP, throughput and lead time.',
    'Open PDF ↗',
    'More help in the Help Center ↗',
  ]],
  ['Your data and storage', [
    "Unless you sign in and choose cloud storage, SPERT® CFD keeps your projects in this browser, on this device, and sends them to no server. Clearing this site's data deletes them, so export a backup from time to time.",
    'If you sign in, with Google or with a Microsoft work or school account, and choose cloud storage, your projects are saved to your account in Google Firebase, over encrypted (HTTPS) connections. You can then open them on any device and share them with other people.',
  ]],
  ['Version and license', [
    `Version ${APP_VERSION} · What's new`,
    'Created by William W. Davis, MSPM, PMP · Source code on GitHub ↗',
    '© 2026 William W. Davis, MSPM, PMP. SPERT® CFD is free software: you may use, change and share it under the GNU General Public License, version 3, with the additional terms its LICENSE ↗ adds under Section 7 of that license: attribution and legal notices, trademarks, the marking of modified versions, endorsement, and indemnification.',
    'SPERT®, Statistical PERT® and Estimation Made Easy® are registered trademarks of famousdavis, LLC. GanttApp™ and MyScrumBudget™ are trademarks of famousdavis, LLC.',
    'THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY APPLICABLE LAW. EXCEPT WHEN OTHERWISE STATED IN WRITING THE COPYRIGHT HOLDERS AND/OR OTHER PARTIES PROVIDE THE PROGRAM "AS IS" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE PROGRAM IS WITH YOU. SHOULD THE PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF ALL NECESSARY SERVICING, REPAIR OR CORRECTION.',
  ]],
];

describe('the About page’s words (v0.24.0; Guides v0.25.0)', () => {
  it('no longer says SPERT® CFD has no guide (v0.25.0)', () => {
    const { container } = render(<AboutTab />);
    expect(container.textContent).not.toContain('has no downloadable guide');
  });

  it('has the six sections, in §7’s order, each with exactly its approved words', () => {
    const { container } = render(<AboutTab />);
    const got = [...container.querySelectorAll('.sf-about > section')].map((s): [string, string[]] => [
      text(s.querySelector(':scope > h2')!),
      // A guide row (li.sf-guide) is read as its three parts, title, description and open link, so they don't run together.
      [...s.querySelectorAll(':scope > p, :scope > ol > li, :scope > ul > li')].flatMap((el) =>
        el.matches('li.sf-guide')
          ? [...el.querySelectorAll('.sf-guide-title, .sf-guide-text, .sf-guide-open')].map(text)
          : [text(el)]),
    ]);
    // querySelectorAll keeps document order: Flow metrics' list sits between its first and second paragraph.
    expect(got).toEqual(EXPECTED);
  });
});
