// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useSyncExternalStore } from 'react';
import { useProjectList } from '@/contexts/project-list-context';
import {
  dismissCloudSetAsideNotices,
  getCloudSetAsideProjects,
  getNoCloudSetAsideProjects,
  subscribeCloudSetAsideNotices,
} from '@/lib/cloud-load-notices';
import { UNNAMED_PROJECT } from '@/lib/cloud-load-guards';

/**
 * v0.16.4: names the projects in which a cloud-load check left something
 * out (see `cloud-load-guards.ts`). Names projects only, never the value. A
 * project no longer in the list (after sign-out, say) is not named. "Got it"
 * closes it for the session.
 */
export function CloudLoadNoticeBanner() {
  const projectIds = useSyncExternalStore(
    subscribeCloudSetAsideNotices,
    getCloudSetAsideProjects,
    getNoCloudSetAsideProjects,
  );
  const { projects } = useProjectList();

  const names = projectIds
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map((p) => `“${p.name || UNNAMED_PROJECT}”`);
  if (names.length === 0) return null;

  return (
    // v0.22.0 (FRAME26): the frame's caution notice, in the notices slot,
    // after the local-storage caution (contract §6).
    <div role="status" className="sf-notice sf-notice--caution">
      <p className="flex-1">
        <strong>Some saved data could not be read</strong> in{' '}
        {names.length === 1 ? 'project' : 'projects'} {names.join(', ')}. It is not shown; the
        rest loaded normally.
      </p>
      <button type="button" onClick={dismissCloudSetAsideNotices} className="sf-notice-dismiss">
        Got it
      </button>
    </div>
  );
}
