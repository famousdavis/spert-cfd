// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// Y1 (FRAME26 pass 3, v0.24.0): the footer's © and the About page's © read one source, copyrightYear(), so they can
// never differ. And the hydration seam: the shell is prerendered at build time, so its HTML carries the build's year.
// The page is rendered to HTML with the clock in 2026 (the build), then hydrated with the clock in 2027 (a visitor
// after 1 January): React must report no mismatch and log nothing, and the page must end up saying 2027. Two controls
// show the instrument sees the fault: the year written plainly is reported, and suppressHydrationWarning alone keeps
// the build's year on screen.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import type { ReactElement } from 'react';

import { Footer } from '@/components/footer';
import { AboutTab } from '@/components/about-tab';
import { copyrightYear } from '../copyright';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const at = (y: number, m: number, d: number) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(y, m, d, 12)); };
const yearIn = (el: Element | null) => el!.textContent!.match(/© ?(\d{4})/)![1];
const years = (root: ParentNode) => ({ footer: yearIn(root.querySelector('[data-sf="footer"]')), about: yearIn(root.querySelector('[data-sf="about-legal"]')) });
const Page = () => <><AboutTab /><Footer /></>;
function Plain() { return <p>© {copyrightYear()} William</p>; }
function SuppressedOnly() { return <p>© <span suppressHydrationWarning>{copyrightYear()}</span> William</p>; }

/** Render to HTML in 2026, hydrate that HTML in 2027; what React reported and logged, and what the page says. */
async function buildIn2026HydrateIn2027(el: ReactElement) {
  at(2026, 11, 31);
  const container = document.createElement('div');
  container.innerHTML = renderToString(el);
  document.body.appendChild(container);
  const built = container.textContent!.match(/© ?(\d{4})/)![1];
  at(2027, 0, 1);
  const recoverable = vi.fn();
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  await act(async () => { hydrateRoot(container, el, { onRecoverableError: recoverable }); });
  const result = { built, reported: recoverable.mock.calls.length > 0, logged: consoleError.mock.calls.length, container };
  return result;
}

describe('copyrightYear (Y1)', () => {
  it.each([[2026, 11, 31, '2026'], [2027, 0, 1, '2027']])('on %i-%i-%i the footer and the About page both say %s', (y, m, d, want) => {
    at(y, m, d);
    expect(copyrightYear()).toBe(Number(want));
    const { container } = render(<Page />);
    expect(years(container)).toEqual({ footer: want, about: want });
  });
});

describe('the prerendered year (Y1, hydration)', () => {
  it('control 1, the plain form: the mismatch is reported', async () => {
    const r = await buildIn2026HydrateIn2027(<Plain />);
    expect(r.reported).toBe(true);
    r.container.remove();
  });

  it('control 2, suppressHydrationWarning alone: no report, but "© 2026" stays', async () => {
    const r = await buildIn2026HydrateIn2027(<SuppressedOnly />);
    expect([r.reported, r.logged, yearIn(r.container)]).toEqual([false, 0, '2026']);
    r.container.remove();
  });

  it('the footer and About, built in 2026 and hydrated in 2027: no mismatch, nothing logged, both say 2027', async () => {
    const r = await buildIn2026HydrateIn2027(<Page />);
    expect(r.built).toBe('2026');
    expect([r.reported, r.logged]).toEqual([false, 0]);
    expect(years(r.container)).toEqual({ footer: '2027', about: '2027' });
    r.container.remove();
  });
});
