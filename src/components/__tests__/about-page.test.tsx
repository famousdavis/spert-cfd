// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// The About page in the suite frame (FRAME26 pass 3, v0.24.0; contract §3 About page, §7 About, §9.3 hooks), through
// the real AppShell with About chosen and the real AboutTab. Its structure, its marks and its links; the words are
// about-words.test.tsx's. Geometry and colour are frame-check's, in a browser.

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

const { passThrough } = vi.hoisted(() => ({ passThrough: ({ children }: { children: ReactNode }) => children }));
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/contexts/auth-context', () => ({ AuthProvider: passThrough, useAuth: () => ({ user: null }) }));
vi.mock('@/contexts/storage-context', () => ({ StorageProvider: passThrough, useStorage: () => ({ mode: 'local' }) }));
vi.mock('@/contexts/project-list-context', () => ({
  ProjectListProvider: passThrough,
  useProjectList: () => ({ isLoaded: true, projects: [], switchProject: vi.fn() }),
}));
vi.mock('@/contexts/active-project-context', () => ({ ActiveProjectProvider: passThrough, useActiveProject: () => ({ project: null }) }));
vi.mock('../invitation-banner', () => ({ InvitationBanner: () => null }));
vi.mock('../first-run-banner', () => ({ FirstRunBanner: () => null }));
vi.mock('../local-storage-warning-banner', () => ({ LocalStorageWarningBanner: () => null }));
vi.mock('../cloud-load-notice-banner', () => ({ CloudLoadNoticeBanner: () => null }));
vi.mock('../cloud-storage-modal', () => ({ CloudStorageModal: () => null }));
vi.mock('../projects-tab', () => ({ ProjectsTab: () => <p>projects body</p> }));
vi.mock('../project-dashboard', () => ({ ProjectDashboard: () => null }));
vi.mock('../settings-tab', () => ({ SettingsTab: () => null }));

import { AppShell } from '../app-shell';

function openAbout() {
  render(<AppShell>{null}</AppShell>);
  fireEvent.click(screen.getByRole('button', { name: 'About' }));
  return { main: document.querySelector('main') as HTMLElement, about: document.querySelector('main [data-sf="about"]') as HTMLElement };
}

describe('the About page (v0.24.0)', () => {
  it('is .sf-about, main’s next element after the heading row, with no wrapper', () => {
    const { main, about } = openAbout();
    expect([...main.children].map((c) => c.getAttribute('data-sf'))).toEqual(['headrow', 'about']);
    expect(about.className).toBe('sf-about');
  });

  it('titles the page "About SPERT® CFD", its ® the brand row’s mark', () => {
    openAbout();
    expect(document.querySelector('h1')!.innerHTML).toBe('About SPERT<span class="sf-mark">®</span> CFD');
  });

  it('has §7’s six section headings in order; How it works is a numbered list of five; no guide list; no tagline', () => {
    const { main, about } = openAbout();
    expect([...about.querySelectorAll(':scope > section > h2')].map((h) => h.textContent)).toEqual([
      'What is SPERT® CFD?', 'How it works', 'Flow metrics', 'Guides', 'Your data and storage', 'Version and license',
    ]);
    const how = about.querySelectorAll(':scope > section')[1];
    expect([how.querySelectorAll(':scope > ol > li').length, how.querySelectorAll('ul').length]).toEqual([5, 0]);
    expect(about.querySelector('.sf-guides, [data-sf="guides"]')).toBeNull();
    expect(main.textContent).not.toContain('Cumulative Flow Diagram tool for agile teams');
    expect(about.querySelector(':scope > section:last-child')!.getAttribute('data-sf')).toBe('about-legal');
  });

  it('carries no class but the frame’s own (no utility, no dark: variant)', () => {
    const { about } = openAbout();
    const classes = [...about.querySelectorAll('[class]')].flatMap((e) => [...e.classList]);
    expect(classes.length).toBeGreaterThan(0);
    expect(classes.filter((c) => !c.startsWith('sf-'))).toEqual([]);
  });

  it('bolds only the two list items’ opening labels, Cycle time and Lead time (William, 2026-11-27)', () => {
    const { about } = openAbout();
    const strong = [...about.querySelectorAll('strong, b')];
    expect(strong.map((s) => s.textContent)).toEqual(['Cycle time', 'Lead time']);
    for (const s of strong) {
      expect(s.parentElement!.tagName).toBe('LI');
      expect(s.parentElement!.firstChild).toBe(s);
    }
  });

  it('shows every ® and ™ as the glyph alone in a .sf-mark (™ with .sf-mark--tm), in the h1 and on the page', () => {
    const { main } = openAbout();
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const marks: string[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent ?? '';
      if (!/[®™]/.test(t)) continue;
      const span = n.parentElement!;
      marks.push(`${t}|${span.className}|${span.childNodes.length}`);
    }
    expect(marks.length).toBe(11); // h1 1, What is 2, Guides 1, data 1, © 1, trademarks 5
    expect(new Set(marks)).toEqual(new Set(['®|sf-mark|1', '™|sf-mark sf-mark--tm|1']));
  });

  it('links where §7 says, every new-tab link marked for screen readers; What’s new is the footer’s own /changelog link', () => {
    const { about } = openAbout();
    const links = [...about.querySelectorAll('a')].map((a) => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel'), a.querySelector('.sf-sr')?.textContent ?? null, a.querySelector('[aria-hidden="true"]')?.textContent ?? null]);
    const NT = ' (opens in a new tab)';
    expect(links).toEqual([
      ['https://spertsuite.com/help/cfd', '_blank', 'noopener noreferrer', NT, ' ↗'],
      ['/changelog', null, null, null, null],
      ['https://github.com/famousdavis/spert-cfd', '_blank', 'noopener noreferrer', NT, ' ↗'],
      ['https://github.com/famousdavis/spert-cfd/blob/main/LICENSE', '_blank', 'noopener noreferrer', NT, ' ↗'],
    ]);
    expect(document.querySelector('[data-sf="footer"] a[href="/changelog"]')!.textContent).toMatch(/^Version /);
  });

  it('says the same year in its © line as the footer', () => {
    openAbout();
    const year = (s: string | null | undefined) => s?.match(/© ?(\d{4})/)?.[1];
    const fromAbout = year(document.querySelector('[data-sf="about-legal"]')!.textContent);
    expect(fromAbout).toMatch(/^\d{4}$/);
    expect(fromAbout).toBe(year(document.querySelector('[data-sf="footer"]')!.textContent));
  });
});
