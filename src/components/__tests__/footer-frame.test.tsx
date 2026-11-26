// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// N4 (FRAME26, v0.22.0; stage 0 item 1): the footer is the frame's, and its links take the frame's `--sf-link`. Until
// v0.22.0 the dark links were `blue-600`, 3.38 : 1 on #101828 (DASH26 RD1 O30 kept that on purpose, as a suite-wide
// shortfall); the frame's dark link colour is 6.73. No colour utility and no inline colour on a link: the stylesheet
// is unlayered, so a utility would lose anyway, and a colour here would only hide which one wins.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Footer } from '../footer';

const FRAME = readFileSync(join(process.cwd(), 'src', 'styles', 'spert-frame.css'), 'utf8');
const tokens = (selector: string) => {
  const body = FRAME.split(selector + ' {')[1]?.split('}')[0];
  if (!body) throw new Error(`no rule ${selector}`);
  const get = (name: string) => new RegExp(`${name}:\\s*(#[0-9a-f]{6})`).exec(body)?.[1];
  return { page: get('--sf-page'), link: get('--sf-link'), muted: get('--sf-text-muted') };
};
const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (h: string) => { const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

describe('the footer (FRAME26)', () => {
  it('is the frame\'s footer: two lines in the column, hooked', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer')!;
    expect(footer.className).toBe('sf-footer');
    expect(footer.getAttribute('data-sf')).toBe('footer');
    const col = footer.firstElementChild!;
    expect(col.className).toBe('sf-col');
    expect(col.children).toHaveLength(2);
    for (const line of col.children) expect(line.getAttribute('class')).toBeNull();
  });

  it('keeps its wording and its five links, in order', () => {
    const { container } = render(<Footer />);
    const links = [...container.querySelectorAll('a')].map((a) => a.textContent!.trim());
    expect(links).toEqual([expect.stringMatching(/^Version \d+\.\d+\.\d+$/), 'SPERT® Suite', 'Terms of Service', 'Privacy Policy', 'License']);
    expect(container.textContent).toMatch(/© \d{4} William W\. Davis, MSPM, PMP \| Version .* \| Licensed under GNU GPL v3/);
  });

  it('no link carries a colour, a hover, a decoration class or an inline style: the frame colours them', () => {
    const { container } = render(<Footer />);
    const links = [...container.querySelectorAll('a')];
    expect(links.length, 'must-find: the links').toBe(5);
    for (const a of links) {
      expect(a.getAttribute('class'), a.textContent!).toBeNull();
      expect(a.getAttribute('style'), a.textContent!).toBeNull();
    }
  });

  it('the frame\'s link colour reads at 4.5 : 1 or better on the page in both themes (5.25 and 6.73)', () => {
    const light = tokens(':root');
    const dark = tokens(':root.dark, :root[data-theme="dark"]');
    expect([light.link, light.page, dark.link, dark.page]).toEqual(['#155dfc', '#ffffff', '#51a2ff', '#101828']);
    expect(contrast(light.link!, light.page!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark.link!, dark.page!)).toBeGreaterThanOrEqual(4.5);
    // The ruling it replaces, as a control: the old dark link on the dark page fails.
    expect(contrast('#155dfc', '#101828')).toBeLessThan(4.5);
  });
});
