// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.19.0 (DASH26 R26): an invite link's move to Cloud is checked again at
// sign-in. The link (opened with no local projects) records a request; at
// sign-in the hook takes it, and switches to Cloud only if the local list is
// STILL empty. Until v0.18.0 the link switched the preference at once, and an
// invitee who made a local project before signing in went straight to Cloud
// with no upload prompt: their local projects vanished from view. That life was
// unreachable while an empty local list re-seeded a sample (R20 removed it).
// No browser sign-in: the hook with useAuth, useStorage and the App Router mocked.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const h = vi.hoisted(() => {
  const state = {
    user: null as null | { uid: string },
    params: new URLSearchParams(),
    switchMode: vi.fn(),
    // Stable, as the App Router's is: the hook's effect depends on it.
    router: { replace: () => { state.params = new URLSearchParams(); } },
  };
  return state;
});
vi.mock('next/navigation', () => ({
  useRouter: () => h.router,
  usePathname: () => '/',
  useSearchParams: () => h.params,
}));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/contexts/storage-context', () => ({ useStorage: () => ({ switchMode: h.switchMode, isCloudAvailable: true }) }));

import { useInvitationLanding } from '../use-invitation-landing';
import { LS_INVITE_CLOUD_PENDING } from '@/lib/constants';

/** Opens the app from an invite link, signed out, with `count` local projects. */
function openLink(count: number) {
  window.history.replaceState(null, '', '/?invite=tok-1');
  h.params = new URLSearchParams('invite=tok-1');
  const view = renderHook(({ n }) => useInvitationLanding({ localProjectCount: n }), { initialProps: { n: count } });
  window.history.replaceState(null, '', '/');
  return view;
}
const cloudSwitches = () => h.switchMode.mock.calls.filter(([m]) => m === 'cloud').length;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  h.user = null;
  h.switchMode.mockReset();
});

describe('the invite link\'s move to Cloud, checked at sign-in (R26)', () => {
  it('an empty list at the link, then a local project made before sign-in: no move to Cloud, and the request is used up', () => {
    const view = openLink(0);
    expect(cloudSwitches()).toBe(0); // the link itself moves nothing
    expect(localStorage.getItem(LS_INVITE_CLOUD_PENDING)).toBe('true');
    view.rerender({ n: 1 }); // works locally first
    act(() => { h.user = { uid: 'u1' }; view.rerender({ n: 1 }); });
    expect(cloudSwitches()).toBe(0);
    expect(localStorage.getItem(LS_INVITE_CLOUD_PENDING)).toBeNull();
  });

  it('the list still empty at sign-in: one move to Cloud, as the link intends', () => {
    const view = openLink(0);
    act(() => { h.user = { uid: 'u1' }; view.rerender({ n: 0 }); });
    expect(cloudSwitches()).toBe(1);
    expect(localStorage.getItem(LS_INVITE_CLOUD_PENDING)).toBeNull();
    view.rerender({ n: 0 });
    expect(cloudSwitches()).toBe(1);
  });

  it('projects present at the link: no request, and no move at sign-in (as before)', () => {
    const view = openLink(2);
    expect(localStorage.getItem(LS_INVITE_CLOUD_PENDING)).toBeNull();
    act(() => { h.user = { uid: 'u1' }; view.rerender({ n: 2 }); });
    expect(cloudSwitches()).toBe(0);
  });

  it('a sign-in with no link moves nothing (control)', () => {
    const view = renderHook(({ n }) => useInvitationLanding({ localProjectCount: n }), { initialProps: { n: 0 } });
    act(() => { h.user = { uid: 'u1' }; view.rerender({ n: 0 }); });
    expect(cloudSwitches()).toBe(0);
  });
});
