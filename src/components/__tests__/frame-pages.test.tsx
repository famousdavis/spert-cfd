// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// N3 and N10 (FRAME26, v0.22.0): the real AppShell, with its real header, navigation and footer, on every screen.
// - Every screen: the skip link first, exactly one <main> (#main, hooked), exactly one h1, in main's heading row, and
//   no heading in the header; the current item, or none off the tabs' route.
// - main's exceptions: X1 (`--fit`) on the CFD tab only, X4 (`--capped`) on Settings, About and the changelog only.
// - The notices' order (contract §6) in the frame's slot, after the load only.
// - Loading (contract §7): the frame and the tab's heading row, "Loading...", the chip aria-disabled (D6).
// - N10, routes: off "/" an item or the brand sets the tab and returns to "/"; on "/" nothing routes.
// The Projects tab and the CFD tab's panel are stand-ins here: their own heading row is pinned in
// projects-tab-toolbar.test.tsx and projects-tab-frame.test.tsx, the panel in project-dashboard-*.test.tsx.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  pathname: '/' as string,
  push: vi.fn(),
  isLoaded: true,
  project: null as null | { name: string },
}));
const { passThrough } = vi.hoisted(() => ({ passThrough: ({ children }: { children: ReactNode }) => children }));

vi.mock('next/navigation', () => ({ usePathname: () => h.pathname, useRouter: () => ({ push: h.push }) }));
vi.mock('@/contexts/auth-context', () => ({ AuthProvider: passThrough, useAuth: () => ({ user: null }) }));
vi.mock('@/contexts/storage-context', () => ({ StorageProvider: passThrough, useStorage: () => ({ mode: 'local' }) }));
vi.mock('@/contexts/project-list-context', () => ({
  ProjectListProvider: passThrough,
  useProjectList: () => ({ isLoaded: h.isLoaded, projects: [], switchProject: vi.fn() }),
}));
vi.mock('@/contexts/active-project-context', () => ({ ActiveProjectProvider: passThrough, useActiveProject: () => ({ project: h.project }) }));
vi.mock('../invitation-banner', () => ({ InvitationBanner: () => <div data-notice="invitation" /> }));
vi.mock('../first-run-banner', () => ({ FirstRunBanner: () => <div data-notice="terms" /> }));
vi.mock('../local-storage-warning-banner', () => ({ LocalStorageWarningBanner: () => <div data-notice="caution" /> }));
vi.mock('../cloud-load-notice-banner', () => ({ CloudLoadNoticeBanner: () => <div data-notice="cloud-load" /> }));
vi.mock('../cloud-storage-modal', () => ({ CloudStorageModal: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Cloud Storage" /> : null) }));
vi.mock('../projects-tab', async () => {
  const { HeadingRow } = await import('../heading-row');
  return { ProjectsTab: () => <><HeadingRow>Projects</HeadingRow><p>projects body</p></> };
});
vi.mock('../project-dashboard', () => ({ ProjectDashboard: () => <div data-testid="cfd-panel" /> }));
vi.mock('../settings-tab', () => ({ SettingsTab: () => <p>settings body</p> }));

import { AppShell } from '../app-shell';
import { HeadingRow } from '../heading-row';

const navButton = (name: string) => screen.getByRole('button', { name });
const main = () => document.querySelector('main') as HTMLElement;

function show(tab?: 'Projects' | 'CFD' | 'Settings' | 'About', page: ReactNode = null) {
  const view = render(<AppShell>{page}</AppShell>);
  if (tab && tab !== 'Projects') fireEvent.click(navButton(tab));
  return view;
}

/** What every framed screen shares. */
function framed(h1: string, current: string | null) {
  expect(document.querySelectorAll('main')).toHaveLength(1);
  expect(main().id).toBe('main');
  expect(main().getAttribute('data-sf')).toBe('main');
  const h1s = [...document.querySelectorAll('h1')];
  expect(h1s.map((e) => e.textContent)).toEqual([h1]);
  expect(h1s[0].parentElement!.getAttribute('data-sf')).toBe('headrow');
  expect(h1s[0].parentElement!.parentElement).toBe(main());
  expect(document.querySelector('header')!.querySelector('h1, h2, h3, [role="heading"]')).toBeNull();
  const currentItems = [...document.querySelectorAll('[data-sf="nav"] [aria-current]')];
  expect(currentItems.map((e) => [e.textContent, e.getAttribute('aria-current')])).toEqual(current ? [[current, 'page']] : []);
  const skip = document.querySelector('[data-sf="skip"]') as HTMLAnchorElement;
  expect(skip.textContent).toBe('Skip to main content');
  expect(skip.getAttribute('href')).toBe('#main');
  const app = document.querySelector('[data-sf="app"]')!;
  expect(app.querySelector('a[href], button, input, select, textarea, [tabindex]')).toBe(skip);
  expect([...app.children].map((e) => e.tagName.toLowerCase() + (e.getAttribute('data-sf') ? `[${e.getAttribute('data-sf')}]` : ''))).toEqual(
    expect.arrayContaining(['a[skip]', 'header', 'nav[nav]', 'div[notices]', 'main[main]', 'footer[footer]']),
  );
}

beforeEach(() => {
  h.pathname = '/';
  h.push.mockReset();
  h.isLoaded = true;
  h.project = null;
});

describe('the frame on every screen (N3)', () => {
  it('Projects: its own heading row, standard column', () => {
    show();
    framed('Projects', 'Projects');
    expect(main().className).toBe('sf-col sf-main');
  });

  it('CFD with a project open: the LOADED project\'s name, full name in title, X1 fitted body', () => {
    h.project = { name: 'Sample: 2-Week Sprint' };
    show('CFD');
    framed('Sample: 2-Week Sprint', 'CFD');
    expect(screen.getByRole('heading', { level: 1 }).getAttribute('title')).toBe('Sample: 2-Week Sprint');
    expect(main().className).toBe('sf-col sf-main sf-main--fit flex flex-col');
    const body = screen.getByTestId('cfd-panel').parentElement!;
    expect(body.className).toBe('sf-below flex min-h-0 flex-1 flex-col');
    expect(body.parentElement).toBe(main());
  });

  it('CFD with no project: "CFD"', () => {
    show('CFD');
    framed('CFD', 'CFD');
  });

  it('Settings: "Settings", X4 capped, the body in .sf-below', () => {
    show('Settings');
    framed('Settings', 'Settings');
    expect(main().className).toBe('sf-col sf-main sf-main--capped');
    expect(screen.getByText('settings body').closest('.sf-below')!.parentElement).toBe(main());
  });

  it('About: "About SPERT® CFD", the ® at weight 400, X4 capped', () => {
    show('About');
    framed('About SPERT® CFD', 'About');
    expect(main().className).toBe('sf-col sf-main sf-main--capped');
    expect(screen.getByRole('heading', { level: 1 }).querySelector('.font-normal')!.textContent).toBe('®');
  });

  it('the changelog: its page in main, X4 capped, no item current', () => {
    h.pathname = '/changelog';
    show(undefined, <><HeadingRow>Changelog</HeadingRow><div className="sf-below">entries</div></>);
    framed('Changelog', null);
    expect(main().className).toBe('sf-col sf-main sf-main--capped');
    expect(screen.queryByText('projects body')).toBeNull();
  });

  it('a 404: its page in main, the standard column, no item current', () => {
    h.pathname = '/no-such-page';
    show(undefined, <HeadingRow>Page not found</HeadingRow>);
    framed('Page not found', null);
    expect(main().className).toBe('sf-col sf-main');
  });

  it('only the CFD tab is fitted, and only Settings, About and the changelog are capped', () => {
    const seen: Record<string, string> = {};
    for (const tab of ['Projects', 'CFD', 'Settings', 'About'] as const) {
      const { unmount } = show(tab);
      seen[tab] = main().className;
      unmount();
    }
    expect(Object.entries(seen).filter(([, c]) => c.includes('--fit')).map(([t]) => t)).toEqual(['CFD']);
    expect(Object.entries(seen).filter(([, c]) => c.includes('--capped')).map(([t]) => t)).toEqual(['Settings', 'About']);
  });

  it('the notices sit in the frame\'s slot, in the contract\'s order: invitation, terms, caution, cloud-load', () => {
    show();
    const slot = document.querySelector('[data-sf="notices"]')!;
    expect(slot.className).toBe('sf-col sf-notices');
    expect([...slot.children].map((e) => e.getAttribute('data-notice'))).toEqual(['invitation', 'terms', 'caution', 'cloud-load']);
    expect(slot.nextElementSibling).toBe(main());
  });
});

describe('loading (contract §7, D6)', () => {
  it('renders the frame first: the heading row and "Loading..." in main, no notices yet, the chip aria-disabled', () => {
    h.isLoaded = false;
    show();
    framed('Projects', 'Projects');
    expect(main().textContent).toContain('Loading...');
    expect(document.querySelector('[data-sf="notices"]')!.children).toHaveLength(0);
    const chip = screen.getByRole('button', { name: 'Sign in' });
    expect(chip.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(chip);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('after the load the chip is no longer aria-disabled, and opens Cloud Storage', () => {
    show();
    const chip = screen.getByRole('button', { name: 'Sign in' });
    expect(chip.hasAttribute('aria-disabled')).toBe(false);
    fireEvent.click(chip);
    expect(screen.getByRole('dialog', { name: 'Cloud Storage' })).toBeTruthy();
  });

  it('on another route the page shows at once, not "Loading..."', () => {
    h.isLoaded = false;
    h.pathname = '/changelog';
    show(undefined, <p>the changelog</p>);
    expect(main().textContent).toBe('the changelog');
  });
});

describe('routes (N10)', () => {
  it('off "/", an item sets the tab and returns to "/"; the tab travels in state', () => {
    h.pathname = '/changelog';
    const view = render(<AppShell><p>the changelog</p></AppShell>);
    fireEvent.click(navButton('Settings'));
    expect(h.push).toHaveBeenCalledWith('/');
    h.pathname = '/';
    view.rerender(<AppShell>{null}</AppShell>);
    expect(navButton('Settings').getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Settings');
  });

  it('off "/", the brand shows Projects and returns to "/"', () => {
    h.pathname = '/no-such-page';
    render(<AppShell><p>404</p></AppShell>);
    fireEvent.click(screen.getByRole('link', { name: 'SPERT® CFD' }));
    expect(h.push).toHaveBeenCalledWith('/');
  });

  it('on "/", items and the brand switch tabs without routing', () => {
    show();
    fireEvent.click(navButton('About'));
    fireEvent.click(screen.getByRole('link', { name: 'SPERT® CFD' }));
    expect(navButton('Projects').getAttribute('aria-current')).toBe('page');
    expect(h.push).not.toHaveBeenCalled();
  });
});
