// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import type { PendingInvite } from '@/types';

interface PendingInvitesListProps {
  pendingInvites: PendingInvite[];
  /** tokenId of the row whose action is in flight; null otherwise.
   *  Drives the per-row "Working…" label and disables every row's
   *  buttons while any one action runs. */
  actionBusy: string | null;
  onResend: (tokenId: string) => void;
  onRevoke: (tokenId: string) => void;
}

function formatDate(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString();
}

/**
 * List of pending invitations with Resend/Revoke per row. The
 * AHP-only voting toggle column is intentionally absent — CFD has
 * no voting collaborator concept.
 */
export function PendingInvitesList({
  pendingInvites,
  actionBusy,
  onResend,
  onRevoke,
}: PendingInvitesListProps) {
  if (pendingInvites.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-medium text-gray-700">
        Pending invitations ({pendingInvites.length})
      </h4>
      <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
        {pendingInvites.map((p) => {
          const sendCount = p.emailSendCount ?? 0;
          const rowBusy = actionBusy === p.tokenId;
          const anyBusy = actionBusy !== null;
          return (
            <li
              key={p.tokenId}
              className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-gray-900">{p.inviteeEmail}</div>
                <div className="text-[11px] text-gray-500">
                  {p.role}
                  {p.lastEmailSentAt
                    ? ` · sent ${formatDate(p.lastEmailSentAt)} (${sendCount}/5)`
                    : ` · sent (${sendCount}/5)`}
                  {p.expiresAt ? ` · expires ${formatDate(p.expiresAt)}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onResend(p.tokenId)}
                  disabled={anyBusy}
                  className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                  aria-label={`Resend invitation to ${p.inviteeEmail}`}
                >
                  {rowBusy ? 'Working…' : 'Resend'}
                </button>
                <button
                  type="button"
                  onClick={() => onRevoke(p.tokenId)}
                  disabled={anyBusy}
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  aria-label={`Revoke invitation to ${p.inviteeEmail}`}
                >
                  Revoke
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
