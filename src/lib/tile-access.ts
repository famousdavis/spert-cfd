// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { ProjectMemberRole, StorageMode } from './storage-driver';

/** Why Delete is disabled for an editor or a viewer (the mock-up's words, DASH26 O5). */
export const OWNER_ONLY_DELETE_REASON =
  "Only the project's owner can delete it. To remove it from your list, ask the owner to stop sharing it with you.";
/** Why Edit is disabled for a viewer. */
export const VIEW_ONLY_REASON = 'View only — this project is shared with you as a viewer.';

export interface TileAccess {
  /** "View only", "Shared", or none. */
  badge: string | null;
  /** Share is offered: the project's cloud owner only. */
  showShare: boolean;
  /** Why Delete is disabled; null when it is offered. */
  deleteBlockedReason: string | null;
  /** Why Edit is disabled; null when it is offered. */
  editBlockedReason: string | null;
}

const OPEN: TileAccess = { badge: null, showShare: false, deleteBlockedReason: null, editBlockedReason: null };

/**
 * What a tile offers, from the list item alone (v0.18.0, DASH26 R1a), never
 * from the slow per-project stats load, so Delete never shows disabled while
 * the stats load.
 * - Local mode: nothing gated and no badge (O11), even on a kept local copy of a
 *   shared cloud project, which still stores `owner` and `members`.
 * - Cloud, role not known yet (a project this browser is still creating, or
 *   is importing until a list read): nothing gated, no Share, no badge (D4).
 *   Since v0.19.0 (DASH26 O23, amended) a project this browser creates (Clone,
 *   Create, Load Sample) is listed as the person's own once its create has
 *   landed, so its Share shows then, without a reload; not before, while the
 *   document may not exist on the server yet (as in Forecaster).
 * - Cloud owner: Share; "Shared" with more than one member (R9).
 * - Cloud editor: Delete disabled (the owner deletes); "Shared".
 * - Cloud viewer: Delete and Edit disabled; "View only" alone, never "Shared"
 *   too (O11).
 */
export function tileAccess(mode: StorageMode, role: ProjectMemberRole | undefined, memberCount: number | undefined): TileAccess {
  if (mode !== 'cloud' || role === undefined) return OPEN;
  const shared = (memberCount ?? 0) > 1 ? 'Shared' : null;
  if (role === 'owner') return { ...OPEN, showShare: true, badge: shared };
  if (role === 'editor') return { ...OPEN, badge: shared, deleteBlockedReason: OWNER_ONLY_DELETE_REASON };
  return { badge: 'View only', showShare: false, deleteBlockedReason: OWNER_ONLY_DELETE_REASON, editBlockedReason: VIEW_ONLY_REASON };
}
