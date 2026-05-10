// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import type { FirebaseError } from 'firebase/app';
import { X } from 'lucide-react';
import { db, type SendInvitationEmailResult } from '@/lib/firebase';
import { callSendInvitationEmail } from '@/lib/callables';
import { useAuth } from '@/contexts/auth-context';
import { useStorage } from '@/contexts/storage-context';
import { useEscapeKey } from '@/lib/use-dismiss';
import { PROJECTS_COL } from '@/lib/firestore-helpers';
import { INVITATIONS_ENABLED } from '@/lib/feature-flags';
import { parseBulkEmails } from '@/lib/parse-bulk-emails';
import { mapInvitationError } from '@/lib/invitation-errors';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PendingInvitesList } from '@/components/pending-invites-list';
import type { Project, PendingInvite } from '@/types';
import type { StorageDriver } from '@/lib/storage-driver';

type MemberRole = 'owner' | 'editor' | 'viewer';

// Lesson 60: four-state ownership replaces a boolean isOwner so a
// failed loadProject (Firestore offline, transient network) surfaces
// as a visible error instead of silently rendering the modal in
// not-owner mode.
type OwnerStatus = 'loading' | 'owner' | 'not-owner' | 'error';

interface MemberDisplay {
  uid: string;
  role: MemberRole;
}

interface SharingModalProps {
  projectId: string;
  onClose: () => void;
}

export function SharingModal({ projectId, onClose }: SharingModalProps) {
  const { user } = useAuth();
  const { driver } = useStorage();
  const modalRef = useRef<HTMLDivElement>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Surfaces member-removal and role-change errors. Invitation-flow
  // errors live inside InvitationSection's own error state.
  const [error, setError] = useState<string | null>(null);
  // Confirmation dialog for member removal (replaces window.confirm).
  const [removeUid, setRemoveUid] = useState<string | null>(null);

  useEscapeKey(onClose);

  // Focus modal on mount
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  // Load project data. Lesson 60: surface load failures via the
  // OwnerStatus 'error' arm instead of swallowing them — without this,
  // an offline / transient-network state strands the modal on "Loading…".
  useEffect(() => {
    let cancelled = false;
    driver.loadProject(projectId).then((p) => {
      if (!cancelled) setProject(p);
    }).catch((err) => {
      console.error('Failed to load project for sharing:', (err as { code?: string }).code ?? 'unknown');
      if (!cancelled) setLoadError(true);
    });
    return () => { cancelled = true; };
  }, [projectId, driver]);

  // Real-time sync for member updates while modal is open
  useEffect(() => {
    if (driver.mode !== 'cloud') return;
    const unsub = driver.onProjectChange(projectId, (updated) => {
      if (updated) setProject(updated);
    });
    return unsub;
  }, [projectId, driver]);

  const members: MemberDisplay[] = Object.entries(project?.members ?? {}).map(
    ([uid, role]) => ({ uid, role }),
  );
  const ownerStatus: OwnerStatus = (() => {
    if (loadError) return 'error';
    if (!project) return 'loading';
    if (!user) return 'not-owner';
    if (project.owner === user.uid) return 'owner';
    return 'not-owner';
  })();

  // Authoritative project refresh after the InvitationSection mutates
  // members. Lesson 64-aware: failures are warned, not surfaced — the
  // cloud onProjectChange subscription will eventually reconcile.
  const handleMembersUpdate = useCallback(async () => {
    try {
      const fresh = await driver.loadProject(projectId);
      if (fresh) setProject(fresh);
    } catch (err) {
      console.warn(
        '[SharingModal] post-send project refresh failed:',
        (err as { code?: string }).code ?? err,
      );
    }
  }, [driver, projectId]);

  const handleOwnerStatusError = useCallback(() => {
    setLoadError(true);
  }, []);

  // ─── Member-row actions ────────────────────────────────────
  const handleRemoveConfirm = useCallback(async () => {
    if (!removeUid || !project) return;
    const targetUid = removeUid;
    setRemoveUid(null);
    setError(null);
    try {
      // Routed through the driver adapter. The driver wraps the
      // member removal in a runTransaction with three semantic guards
      // (self-removal, owner-only, owner-not-target — see Lesson 50).
      // Guard failures throw plain Error so `e.message` is a
      // user-meaningful string; intentionally NOT routed through
      // mapInvitationError, which is reserved for Cloud Function
      // FirebaseError codes.
      await driver.removeCollaborator(project.id, targetUid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove member');
    }
  }, [removeUid, project, driver]);

  const handleChangeRole = useCallback(
    async (targetUid: string, newRole: MemberRole) => {
      if (!db || !project || !user || project.owner !== user.uid) return;

      const updatedMembers = {
        ...project.members,
        [targetUid]: newRole,
      };

      try {
        await setDoc(
          doc(db, PROJECTS_COL, project.id),
          { members: updatedMembers },
          { merge: true },
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to change role');
      }
    },
    [project, user],
  );

  if (ownerStatus === 'loading') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl text-center text-gray-400">
          Loading...
        </div>
      </div>
    );
  }

  if (ownerStatus === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div
          ref={modalRef}
          tabIndex={-1}
          className="w-full max-w-md rounded-lg bg-white shadow-xl outline-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sharing-modal-title"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 id="sharing-modal-title" className="text-sm font-semibold">
              Share
            </h2>
            <button
              onClick={onClose}
              className="rounded p-1 text-gray-400 hover:text-gray-700"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <div className="p-4">
            <p className="text-sm text-red-600">
              Couldn&apos;t load sharing details. Refresh the page to try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Beyond this point ownerStatus is 'owner' or 'not-owner' — `project`
  // is non-null because both 'loading' and 'error' arms returned above.
  if (!project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-lg bg-white shadow-xl outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sharing-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id="sharing-modal-title" className="text-sm font-semibold">
            Share — {project.name}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {ownerStatus === 'not-owner' && (
            <p className="mb-3 text-sm text-gray-500">
              Shared with you. Only the owner can manage members.
            </p>
          )}

          {/* Member list */}
          <div className="mb-4 space-y-2">
            {members.map((m) => (
              <div
                key={m.uid}
                className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm"
              >
                <span className="text-gray-700 truncate max-w-[180px]">
                  {m.uid === user?.uid ? 'You' : m.uid}
                </span>
                <div className="flex items-center gap-2">
                  {m.role === 'owner' ? (
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                      Owner
                    </span>
                  ) : ownerStatus === 'owner' ? (
                    <>
                      <select
                        id={`sharing-member-role-${m.uid}`}
                        name={`sharing-member-role-${m.uid}`}
                        value={m.role}
                        onChange={(e) =>
                          handleChangeRole(m.uid, e.target.value as MemberRole)
                        }
                        aria-label={`Role for ${m.uid === user?.uid ? 'you' : m.uid}`}
                        className="rounded border border-gray-300 px-1 py-0.5 text-xs"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => setRemoveUid(m.uid)}
                        className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {m.role}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add UI — owner only. v0.12.2 (L-6): the legacy single-
              email form has been removed; bulk-invite via Cloud
              Function is the only add path. INVITATIONS_ENABLED is
              still consulted so a flag-off build hides the add UI
              entirely (rather than showing a broken section). */}
          {ownerStatus === 'owner' && INVITATIONS_ENABLED && (
            <InvitationSection
              projectId={projectId}
              driver={driver}
              ownerStatus={ownerStatus}
              members={members}
              onMembersUpdate={handleMembersUpdate}
              onOwnerStatusError={handleOwnerStatusError}
            />
          )}

          {/* Member-removal and role-change errors. Invitation-flow
              errors live inside InvitationSection. */}
          {error && (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          )}
        </div>
      </div>

      {/* Member-removal confirmation (replaces window.confirm) */}
      {removeUid && (
        <ConfirmDialog
          title="Remove collaborator"
          message="This person will lose access to the project."
          confirmLabel="Remove"
          variant="danger"
          onConfirm={handleRemoveConfirm}
          onCancel={() => setRemoveUid(null)}
        />
      )}
    </div>
  );
}

// ─── InvitationSection ─────────────────────────────────────
// Sibling sub-component owning the bulk-invite flow, the pending-invite
// list, and the revoke confirm dialog. Pattern parallels Story Map
// v0.29.1 / GanttApp v0.22.1: declared in the same file as its parent
// to keep the file's concept surface contiguous while isolating the
// sub-feature's state and effects.

interface InvitationSectionProps {
  projectId: string;
  driver: StorageDriver;
  ownerStatus: OwnerStatus;
  members: MemberDisplay[];
  /** Notify parent that project members have changed and the parent
   *  should re-fetch authoritative project data. */
  onMembersUpdate: () => void;
  /** Escalate to parent's owner-status error arm. Reserved for cases
   *  where a permission failure suggests ownership has been revoked
   *  mid-session. Currently unused by the basic flows; retained on the
   *  contract for future invariant enforcement. */
  onOwnerStatusError: () => void;
}

// SECURITY MODEL — resend cap (5×/invitation) is enforced SERVER-SIDE.
// The architectural backstop is `allow write: if false` on
// spertsuite_invitations (firestore.rules), which makes client-side
// emailSendCount tampering impossible: only the resendInvite Cloud
// Function (Admin SDK) can mutate the counter, and the CF rejects
// further sends when emailSendCount >= 5 with HttpsError
// 'resource-exhausted'. The per-row "Working…" disable below
// (handleResend → setActionBusy) and the "(N/5)" display in
// PendingInvitesList are UX surfaces, not security controls.
// Removing the disable would NOT unlock more sends — the CF would
// still reject. See v0.12.2 audit finding L-3 and the block comment
// on `match /spertsuite_invitations/{tokenId}` in firestore.rules.
function InvitationSection({
  projectId,
  driver,
  ownerStatus,
  members: _members,
  onMembersUpdate,
  onOwnerStatusError: _onOwnerStatusError,
}: InvitationSectionProps) {
  const [bulkEmails, setBulkEmails] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<SendInvitationEmailResult | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  // tokenId of the pending-invite row whose action is in flight; null
  // otherwise. Disables every row's buttons while one runs.
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [revokeTokenId, setRevokeTokenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshPending = useCallback(async () => {
    if (!INVITATIONS_ENABLED) return;
    if (driver.mode !== 'cloud') return;
    try {
      const list = await driver.listPendingInvites(projectId);
      setPendingInvites(list);
    } catch (e) {
      console.error('listPendingInvites failed:', (e as Error).message);
    }
  }, [driver, projectId]);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  const handleBulkSend = useCallback(async () => {
    // Defensive guard: parent gates render on ownerStatus === 'owner',
    // but a concurrent ownership change could land between renders.
    if (ownerStatus !== 'owner') return;
    setError(null);
    setLastResult(null);
    const { valid, invalid } = parseBulkEmails(bulkEmails);

    // Empty input — neither valid nor invalid tokens parsed.
    if (valid.length === 0 && invalid.length === 0) {
      setError('Enter at least one email address.');
      return;
    }

    // All-invalid: skip the CF entirely (nothing for it to do) and
    // surface the rejected tokens via the result chips. Retain
    // textarea content so the user can correct typos in place
    // without re-pasting the whole list (Lesson 43).
    if (valid.length === 0) {
      setLastResult({
        added: [],
        invited: [],
        failed: invalid.map((email) => ({ email, reason: 'invalid-format' })),
      });
      return;
    }

    if (valid.length > 25) {
      setError('You can invite at most 25 people per submission.');
      return;
    }

    setSending(true);
    try {
      const data = await callSendInvitationEmail({
        appId: 'spertcfd',
        modelId: projectId,
        emails: valid,
        role,
        // CFD has no voting concept — always false. Kept on the
        // suite-shared schema for cross-app compatibility.
        isVoting: false,
      });
      // Merge client-side invalid-format rejections into the CF result
      // so all "skipped" reasons render in one chip surface.
      setLastResult({
        added: data.added,
        invited: data.invited,
        failed: [
          ...invalid.map((email) => ({
            email,
            reason: 'invalid-format' as const,
          })),
          ...data.failed,
        ],
      });
      setBulkEmails('');
      // The auto-add path mutates the project document. The cloud
      // onProjectChange subscription will eventually push the new
      // member state, but we don't wait — fetch authoritatively in
      // parallel with the pending-invite refresh so result chips and
      // member list update together. Lesson 64: allSettled, not all —
      // a pending-list failure must not discard a fulfilled member fetch.
      const [projectResult, pendingResult] = await Promise.allSettled([
        Promise.resolve(onMembersUpdate()),
        refreshPending(),
      ]);
      if (projectResult.status === 'rejected') {
        console.warn(
          '[SharingModal] post-send project refresh failed:',
          projectResult.reason,
        );
      }
      if (pendingResult.status === 'rejected') {
        console.warn(
          '[SharingModal] post-send pending refresh failed:',
          pendingResult.reason,
        );
      }
    } catch (e) {
      setError(mapInvitationError(e as FirebaseError, 'send'));
    } finally {
      setSending(false);
    }
  }, [ownerStatus, bulkEmails, role, projectId, refreshPending, onMembersUpdate]);

  // ─── Pending-invite actions ────────────────────────────────
  const handleResend = useCallback(async (tokenId: string) => {
    setActionBusy(tokenId);
    setError(null);
    try {
      await driver.resendInvite(tokenId);
      await refreshPending();
    } catch (e) {
      setError(mapInvitationError(e as FirebaseError, 'resend'));
    } finally {
      setActionBusy(null);
    }
  }, [driver, refreshPending]);

  const handleRevoke = useCallback(async () => {
    if (!revokeTokenId) return;
    const tokenId = revokeTokenId;
    setRevokeTokenId(null);
    setActionBusy(tokenId);
    setError(null);
    try {
      await driver.revokeInvite(tokenId);
      await refreshPending();
    } catch (e) {
      setError(mapInvitationError(e as FirebaseError, 'revoke'));
    } finally {
      setActionBusy(null);
    }
  }, [revokeTokenId, driver, refreshPending]);

  // ─── Result chip rendering ─────────────────────────────────
  const renderResultSummary = () => {
    if (!lastResult) return null;
    const lines: string[] = [];
    if (lastResult.added.length > 0) {
      lines.push(`Added ${lastResult.added.length}: ${lastResult.added.join(', ')}`);
    }
    if (lastResult.invited.length > 0) {
      lines.push(`Invited ${lastResult.invited.length}: ${lastResult.invited.join(', ')}`);
    }
    if (lastResult.failed.length > 0) {
      const grouped = lastResult.failed.map((f) => `${f.email} (${f.reason})`).join(', ');
      lines.push(`Skipped ${lastResult.failed.length}: ${grouped}`);
    }
    if (lines.length === 0) return null;
    return (
      <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    );
  };

  return (
    <>
      <p className="mb-2 text-xs text-gray-500">
        Invite collaborators by email. Existing SPERT users are added immediately;
        new emails receive a one-time invitation link (expires in 30 days).
      </p>
      <textarea
        id="sharing-bulk-emails"
        name="sharing-bulk-emails"
        value={bulkEmails}
        onChange={(e) => setBulkEmails(e.target.value)}
        placeholder="alice@example.com, bob@example.com&#10;carol@example.com"
        disabled={sending}
        rows={3}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        aria-label="Email addresses to invite"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          id="sharing-invite-role"
          name="sharing-invite-role"
          value={role}
          onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
          disabled={sending}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          aria-label="Role for invitees"
        >
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <button
          onClick={handleBulkSend}
          disabled={sending || !bulkEmails.trim()}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Add'}
        </button>
        <span className="text-xs text-gray-400">Max 25 per day.</span>
      </div>
      {renderResultSummary()}

      {/* Invitation-flow error surface (local to this section). */}
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}

      {/* Pending invites list */}
      <div className="mt-4">
        <PendingInvitesList
          pendingInvites={pendingInvites}
          actionBusy={actionBusy}
          onResend={handleResend}
          onRevoke={(tokenId) => setRevokeTokenId(tokenId)}
        />
      </div>

      {/* Revoke confirmation (replaces window.confirm) */}
      {revokeTokenId && (
        <ConfirmDialog
          title="Revoke invitation"
          message="The invitee won't be able to claim it after revoke."
          confirmLabel="Revoke"
          variant="danger"
          onConfirm={handleRevoke}
          onCancel={() => setRevokeTokenId(null)}
        />
      )}
    </>
  );
}
