// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useInvitationLanding } from '@/hooks/use-invitation-landing';
import { GoogleLogo } from '@/components/icons/google-logo';
import { MicrosoftLogo } from '@/components/icons/microsoft-logo';

/**
 * Renders the dismissible banner for the ?invite=tokenId landing flow.
 * Three visual states:
 *   - hidden when useInvitationLanding returns 'idle'
 *   - "you've been invited" with Google + Microsoft sign-in CTAs
 *     when 'pre_auth'
 *   - "you've been added to X" claim toast when 'claimed'
 *
 * The sign-in CTAs reuse the same brand logos as the CloudStorageModal
 * so the invitee sees a consistent surface regardless of where they
 * trigger sign-in from.
 */
export function InvitationBanner() {
  const { state, dismiss } = useInvitationLanding();
  const { signInWithGoogle, signInWithMicrosoft, firebaseAvailable } = useAuth();
  const [busy, setBusy] = useState<'google' | 'microsoft' | null>(null);

  if (state.kind === 'idle') return null;

  const handleSignIn = async (provider: 'google' | 'microsoft') => {
    setBusy(provider);
    try {
      if (provider === 'google') await signInWithGoogle();
      else await signInWithMicrosoft();
      // useInvitationLanding handles the post-claim transition once
      // AuthContext fires spert:models-changed. If sign-in failed, the
      // sessionStorage token stays put so a retry still works.
    } catch {
      // AuthContext surfaces sign-in errors via signInError; nothing
      // to do here.
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      role="region"
      aria-label="Invitation banner"
      className="mx-auto mt-3 w-[calc(100%-2rem)] max-w-7xl rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {state.kind === 'pre_auth' && (
            <>
              <div className="font-medium">
                You&rsquo;ve been invited to a SPERT CFD project.
              </div>
              {firebaseAvailable ? (
                <>
                  <div className="mt-0.5 text-xs text-blue-800">
                    Sign in with the email address that received this
                    invitation to accept.
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void handleSignIn('google');
                      }}
                      disabled={busy !== null}
                      className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <GoogleLogo />
                      {busy === 'google' ? 'Signing in…' : 'Sign in with Google'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleSignIn('microsoft');
                      }}
                      disabled={busy !== null}
                      className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <MicrosoftLogo />
                      {busy === 'microsoft' ? 'Signing in…' : 'Sign in with Microsoft'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-0.5 text-xs text-blue-800">
                  Cloud sign-in is unavailable in this build.
                </div>
              )}
            </>
          )}
          {state.kind === 'claimed' && (
            <div>
              You&rsquo;ve been added to{' '}
              <span className="font-medium">
                {state.modelNames.length > 0
                  ? state.modelNames.join(', ')
                  : 'a shared project'}
              </span>
              .
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss invitation banner"
          className="-mt-0.5 ml-2 rounded px-2 py-0.5 text-blue-600 hover:bg-blue-100 hover:text-blue-800"
        >
          ×
        </button>
      </div>
    </div>
  );
}
