// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Compile-time feature flags. Flip in code + ship a release to toggle.
 *
 * INVITATIONS_ENABLED: Bulk email invitation flow (v0.9.0).
 *   Off → SharingModal renders the legacy single-email-input UI and
 *         AuthContext does not call claimPendingInvitations.
 *   On  → SharingModal renders the bulk-textarea UI + pending-invite
 *         list, and AuthContext fires claimPendingInvitations on
 *         every auth resolution.
 *
 * Stays OFF until the Landing Page Cloud Functions deploy is
 * validated and the CFD origins pass CORS preflight.
 */
export const INVITATIONS_ENABLED = true;
