// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

/**
 * The root layout carries the theme's three pieces (v0.20.0, DASH26 RD2; PR
 * #111 review -05): the pre-paint script in <head>, ThemeSync in <body> ahead
 * of the page, and suppressHydrationWarning on <html>. Losing any of them
 * changes a dark visitor's first frame, or loses the class later, and no other
 * test sees it. The element tree RootLayout returns is read directly (fonts
 * mocked); nothing is rendered.
 */

vi.mock('next/font/local', () => ({ default: () => ({ variable: 'font-var' }) }));

type El = ReactElement<{ children?: ReactNode; [k: string]: unknown }>;
const kids = (el: El): El[] => Children.toArray(el.props.children).filter(isValidElement) as El[];

async function layout() {
  const { default: RootLayout } = await import('../layout');
  const { THEME_SCRIPT } = await import('@/lib/theme');
  const { ThemeSync } = await import('@/components/theme-sync');
  const { AppShell } = await import('@/components/app-shell');
  const page = <main data-page="" />;
  const html = RootLayout({ children: page }) as El;
  return { html, page, THEME_SCRIPT, ThemeSync, AppShell };
}

describe('the root layout', () => {
  it('<html> carries suppressHydrationWarning (the class is set before React hydrates it)', async () => {
    const { html } = await layout();
    expect(html.type).toBe('html');
    expect(html.props.suppressHydrationWarning).toBe(true);
  });

  it('writes THEME_SCRIPT itself into <head>', async () => {
    const { html, THEME_SCRIPT } = await layout();
    const head = kids(html).find((e) => e.type === 'head');
    expect(head, '<head>').toBeDefined();
    const scripts = kids(head!).filter((e) => e.type === 'script');
    expect(scripts).toHaveLength(1);
    expect((scripts[0].props.dangerouslySetInnerHTML as { __html: string }).__html).toBe(THEME_SCRIPT);
  });

  // v0.22.0 (FRAME26): the page is held by the frame, AppShell, which the
  // layout holds; ThemeSync stays before it, outside every provider.
  it('mounts ThemeSync in <body>, before the frame that holds the page', async () => {
    const { html, page, ThemeSync, AppShell } = await layout();
    const body = kids(html).find((e) => e.type === 'body');
    expect(body, '<body>').toBeDefined();
    const inBody = kids(body!);
    const sync = inBody.findIndex((e) => e.type === ThemeSync);
    const children = inBody.findIndex((e) => e.type === AppShell);
    expect(kids(inBody[children] ?? ({ props: {} } as El)).some((e) => e.type === page.type && 'data-page' in e.props), 'the page inside AppShell').toBe(true);
    expect(sync, 'ThemeSync in <body>').toBeGreaterThanOrEqual(0);
    expect(children, 'AppShell in <body>').toBeGreaterThanOrEqual(0);
    expect(sync).toBeLessThan(children);
  });
});
