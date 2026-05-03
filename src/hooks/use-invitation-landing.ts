// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useStorage } from '@/contexts/storage-context';
import { INVITATIONS_ENABLED } from '@/lib/feature-flags';

const SESSION_KEY = 'spert:pendingInviteToken';
const QUERY_PARAM = 'invite';

export type InvitationLandingState =
  | { kind: 'idle' }
  | { kind: 'pre_auth'; tokenId: string }
  | { kind: 'claimed'; modelNames: string[] };

interface ClaimedDetail {
  appId: string;
  modelId: string;
  modelName: string;
}

/**
 * Manages the ?invite=tokenId landing flow on Next.js App Router.
 *
 *  1. On mount, if the URL carries ?invite=, persist the token to
 *     sessionStorage (so it survives the OAuth popup round-trip and
 *     the consent-modal dance), strip the param via the App Router so
 *     reloads don't replay the banner, force the storage mode
 *     preference to 'cloud' (the invitee can't see the shared project
 *     in local mode), and surface a 'pre_auth' state so the shell can
 *     render a banner with sign-in CTAs.
 *  2. Once the user signs in, AuthContext fires `spert:models-changed`
 *     (which we listen for here too). We transition to 'claimed' with
 *     the names of any newly-claimed projects, then clear sessionStorage.
 *  3. If the user dismisses the banner, the hook returns 'idle' until
 *     the next claim event.
 *
 * Behind INVITATIONS_ENABLED — short-circuits to 'idle' when the
 * flag is off, so production is unchanged.
 *
 * The auto-cloud-mode switch is intentional: an invitee landing from
 * email has unambiguously opted into the shared-cloud workflow.
 *
 * App Router note: usePathname() / useSearchParams() require the
 * consuming component tree to be wrapped in <Suspense> at build
 * time, otherwise `next build` fails. AppShell mounts the Suspense
 * boundary around the InvitationBannerHost.
 */
export function useInvitationLanding(): {
  state: InvitationLandingState;
  dismiss: () => void;
} {
  const { user } = useAuth();
  const { switchMode, isCloudAvailable } = useStorage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<InvitationLandingState>({ kind: 'idle' });

  // 1) Detect ?invite= on first mount (and on URL changes), regardless
  //    of auth state. Strips the param via the App Router so reloads
  //    don't replay the banner.
  useEffect(() => {
    if (!INVITATIONS_ENABLED) return;
    if (typeof window === 'undefined') return;

    const token = searchParams?.get(QUERY_PARAM);
    if (token) {
      try {
        sessionStorage.setItem(SESSION_KEY, token);
      } catch {
        // sessionStorage may be unavailable in private mode — non-fatal.
      }
      // Build a fresh search string without `invite`.
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.delete(QUERY_PARAM);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : (pathname ?? '/'), {
        scroll: false,
      });
      // Pre-flip the storage preference so that whatever path the
      // user takes to sign in (banner CTA or header AuthChip), they
      // end up in cloud mode and can see the freshly-claimed shared
      // project. No observable effect until they sign in
      // (effectiveMode falls back to 'local' while user is null).
      if (isCloudAvailable) switchMode('cloud');
    }

    const stored = (() => {
      try {
        return sessionStorage.getItem(SESSION_KEY);
      } catch {
        return null;
      }
    })();
    if (stored && !user) {
      // Synchronizing React state with an external system
      // (sessionStorage + URL param), exactly the use case the React
      // 19 docs describe as legitimate for setState-in-effect. The
      // lint rule fires on the synchronous call but the alternative
      // (lazy useState initializer) is SSR-unsafe in App Router.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ kind: 'pre_auth', tokenId: stored });
    }
  }, [user, switchMode, isCloudAvailable, router, pathname, searchParams]);

  // 2) Listen for claim events dispatched by AuthContext.
  useEffect(() => {
    if (!INVITATIONS_ENABLED) return;
    if (typeof window === 'undefined') return;
    const onChanged = (evt: Event) => {
      const detail = (evt as CustomEvent<{ claimed?: ClaimedDetail[] }>).detail;
      const claimed = detail?.claimed ?? [];
      if (claimed.length === 0) return;
      const names = claimed.map((c) => c.modelName).filter((n) => n.length > 0);
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        // sessionStorage unavailable — non-fatal.
      }
      setState({ kind: 'claimed', modelNames: names });
    };
    window.addEventListener('spert:models-changed', onChanged);
    return () => window.removeEventListener('spert:models-changed', onChanged);
  }, []);

  // 3) Once the user signs in, clear a lingering 'pre_auth' state.
  //    The claim either succeeded (the listener above will move us to
  //    'claimed') or it failed silently inside AuthContext — in which
  //    case the banner would otherwise strand a signed-in user on a
  //    "you've been invited" banner with non-functional sign-in CTAs.
  //    Functional setState avoids stomping on a 'claimed' state that
  //    may have arrived first under any race ordering.
  useEffect(() => {
    if (!INVITATIONS_ENABLED) return;
    if (!user) return;
    // Functional setState; no-op when state is already the right
    // shape. Same justification as the pre_auth setter above —
    // synchronizing with an external system (auth state).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((prev) => (prev.kind === 'pre_auth' ? { kind: 'idle' } : prev));
  }, [user]);

  return {
    state,
    dismiss: () => {
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        // sessionStorage unavailable — non-fatal.
      }
      setState({ kind: 'idle' });
    },
  };
}
