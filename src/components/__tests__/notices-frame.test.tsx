// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// N8 (FRAME26, v0.22.0; contract §3 "Notices slot", §6): each app notice is the frame's `.sf-notice`, a direct child
// of the slot (no column wrapper and no margin of its own: the slot spaces them), in its variant. "Got it" is the
// frame's outlined `.sf-notice-dismiss`; the invitation's sign-in buttons and its "×" keep their own look. Text
// inside takes the notice's own colour (the frame's notice tokens), so no colour utility is left on the words.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';

const h = vi.hoisted(() => ({
  mode: 'local' as 'local' | 'cloud',
  invite: { kind: 'pre_auth' } as { kind: 'idle' } | { kind: 'pre_auth' } | { kind: 'claimed'; modelNames: string[] },
}));
vi.mock('@/contexts/storage-context', () => ({ useStorage: () => ({ driver: { mode: h.mode } }) }));
vi.mock('@/contexts/project-list-context', () => ({ useProjectList: () => ({ projects: [{ id: 'p1', name: 'Alpha' }] }) }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ signInWithGoogle: vi.fn(), signInWithMicrosoft: vi.fn(), firebaseAvailable: true }) }));
vi.mock('@/hooks/use-invitation-landing', () => ({ useInvitationLanding: () => ({ state: h.invite, dismiss: vi.fn() }) }));

import { FirstRunBanner } from '../first-run-banner';
import { LocalStorageWarningBanner } from '../local-storage-warning-banner';
import { CloudLoadNoticeBanner } from '../cloud-load-notice-banner';
import { InvitationBanner } from '../invitation-banner';
import { noteCloudSetAside, clearCloudSetAsideNotices } from '@/lib/cloud-load-notices';

const MARGIN = /(?:^|:)-?m[trblxy]?-/;
const TEXT_COLOUR = /(?:^|:)text-(?:white|black|gray|slate|blue|amber|red|green|zinc|neutral|\[#)/;
const text = (el: Element) => (el.textContent ?? '').trim();

/** The notice element itself: what the component renders at its root. */
function notice(ui: React.ReactElement) {
  const view = render(<div data-slot="">{ui}</div>);
  const slot = view.container.querySelector('[data-slot]')!;
  expect(slot.children, 'one root element, straight into the slot').toHaveLength(1);
  return slot.firstElementChild as HTMLElement;
}

beforeEach(() => {
  localStorage.clear();
  clearCloudSetAsideNotices();
  h.mode = 'local';
  h.invite = { kind: 'pre_auth' };
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('the app notices in the frame', () => {
  it('the terms notice: info, with the frame\'s "Got it", its links coloured by the notice', () => {
    const n = notice(<FirstRunBanner />);
    expect(n.className).toBe('sf-notice sf-notice--info');
    const [got] = [...n.querySelectorAll('button')];
    expect(text(got)).toBe('Got it');
    expect(got.className).toBe('sf-notice-dismiss');
    for (const a of n.querySelectorAll('a')) expect(a.getAttribute('class'), text(a)).toBeNull();
  });

  it('the local-storage caution: caution, with the frame\'s "Got it"', () => {
    const n = notice(<LocalStorageWarningBanner />);
    expect(n.className).toBe('sf-notice sf-notice--caution');
    expect(n.querySelector('button')!.className).toBe('sf-notice-dismiss');
  });

  it('the cloud-load caution: caution, role=status, with the frame\'s "Got it"', () => {
    const view = render(<div data-slot=""><CloudLoadNoticeBanner /></div>);
    act(() => noteCloudSetAside('p1', 'snapshot'));
    const n = view.container.querySelector('[data-slot]')!.firstElementChild as HTMLElement;
    expect(n.className).toBe('sf-notice sf-notice--caution');
    expect(n.getAttribute('role')).toBe('status');
    expect(n.querySelector('button')!.className).toBe('sf-notice-dismiss');
  });

  it('the invitation: info before the claim and success after it, full width; its sign-in buttons and "×" keep their own look', () => {
    const pre = notice(<InvitationBanner />);
    expect(pre.className).toBe('sf-notice sf-notice--info');
    expect(pre.getAttribute('role')).toBe('region');
    expect(pre.getAttribute('aria-label')).toBe('Invitation banner');
    const buttons = [...pre.querySelectorAll('button')];
    expect(buttons.map((b) => b.getAttribute('aria-label') ?? text(b))).toEqual(['Sign in with Google', 'Sign in with Microsoft', 'Dismiss invitation banner']);
    for (const b of buttons) expect(b.classList.contains('sf-notice-dismiss'), text(b)).toBe(false);
    expect(buttons[0].className).toContain('bg-blue-600');
    h.invite = { kind: 'claimed', modelNames: ['Alpha'] };
    const claimed = notice(<InvitationBanner />);
    expect(claimed.className).toBe('sf-notice sf-notice--success');
  });

  it('"Got it" is .sf-notice-dismiss on exactly the three "Got it" buttons, and on nothing else', () => {
    const roots = [notice(<FirstRunBanner />), notice(<LocalStorageWarningBanner />), notice(<InvitationBanner />)];
    const view = render(<CloudLoadNoticeBanner />);
    act(() => noteCloudSetAside('p1', 'snapshot'));
    roots.push(view.container.firstElementChild as HTMLElement);
    const all = roots.flatMap((r) => [...r.querySelectorAll('.sf-notice-dismiss')]);
    expect(all.map(text)).toEqual(['Got it', 'Got it', 'Got it']);
  });

  it('no notice keeps a margin, a column wrapper or a colour utility on its words', () => {
    const roots = [notice(<FirstRunBanner />), notice(<LocalStorageWarningBanner />), notice(<InvitationBanner />)];
    for (const r of roots) {
      const classes = [r, ...r.querySelectorAll('*')].filter((e) => e.tagName !== 'BUTTON' && !e.closest('button')).flatMap((e) => [...e.classList]);
      expect(classes.filter((c) => TEXT_COLOUR.test(c)), r.className).toEqual([]);
      expect([...r.classList].filter((c) => MARGIN.test(c) || /max-w|mx-auto/.test(c)), r.className).toEqual([]);
    }
  });
});
