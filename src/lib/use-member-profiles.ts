// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { PROFILES_COL, SUITE_PROFILES_COL } from '@/lib/profile-writes';

export interface MemberProfile {
  displayName: string;
  email: string;
}

/**
 * Resolve display profiles for a list of member uids.
 *
 * Added in v0.14.9. Before that the sharing modal had NO profile lookup at all
 * and rendered the raw Firebase Auth UID for every member except yourself.
 *
 * Two-tier lookup, matching the rest of the SPERT® Suite:
 *
 *   1. `spertcfd_profiles/{uid}` — written by this app's own sign-in.
 *   2. `spertsuite_profiles/{uid}` — the cross-app mirror, written alongside
 *      (1) by `writeUserProfile`, and the ONLY record that exists for a member
 *      added through the cross-app invitation Cloud Function. That function
 *      resolves an invitee BY their suite profile and then writes only
 *      `members.{uid}` on the project; it never seeds a per-app profile.
 *
 * Tier 2 is consulted only when tier 1 misses, so a member who has signed into
 * SPERT CFD costs exactly one read. `firestore.rules` already permits `get` on
 * both collections for any authenticated user, so no rules change was needed.
 *
 * The current user is resolved from the auth context without any Firestore
 * read. A uid that resolves nowhere is simply absent from the returned map —
 * callers fall back to whatever they display for an unknown member.
 */
export function useMemberProfiles(uids: string[]): Record<string, MemberProfile> {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});

  // Join rather than pass the array: a new array identity on every render of
  // the caller would otherwise re-run this effect forever.
  const uidKey = uids.join(',');

  useEffect(() => {
    let cancelled = false;

    // Everything, including the empty-input reset, runs inside the async body.
    // A synchronous setState in an effect body trips react-hooks/
    // set-state-in-effect and causes a cascading render; deferring it does not.
    (async () => {
      const database = db;
      if (!database || uids.length === 0) {
        if (!cancelled) setProfiles({});
        return;
      }
      const resolved = await Promise.all(
        uids.map(async (uid): Promise<[string, MemberProfile] | null> => {
          if (user && uid === user.uid) {
            return [uid, { displayName: user.displayName ?? '', email: user.email ?? '' }];
          }
          try {
            let snap = await getDoc(doc(database, PROFILES_COL, uid));
            if (!snap.exists()) {
              snap = await getDoc(doc(database, SUITE_PROFILES_COL, uid));
            }
            if (!snap.exists()) return null;
            const data = snap.data() as { displayName?: string; email?: string };
            return [uid, { displayName: data.displayName ?? '', email: data.email ?? '' }];
          } catch {
            // Transient permission/network failure — caller shows the fallback.
            return null;
          }
        }),
      );
      if (cancelled) return;
      setProfiles(
        Object.fromEntries(resolved.filter((e): e is [string, MemberProfile] => e !== null)),
      );
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uidKey stands in for uids
  }, [uidKey, user]);

  return profiles;
}
