// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import type { FirebaseError } from 'firebase/app';
import { X } from 'lucide-react';
import { db, type SendInvitationEmailResult } from '@/lib/firebase';
import { callSendInvitationEmail } from '@/lib/callables';
import { useAuth } from '@/contexts/auth-context';
import { useStorage } from '@/contexts/storage-context';
import { useEscapeKey } from '@/lib/use-dismiss';
import { PROJECTS_COL, PROFILES_COL, appendChangeLogEntry } from '@/lib/firestore-helpers';
import { INVITATIONS_ENABLED } from '@/lib/feature-flags';
import { parseBulkEmails } from '@/lib/parse-bulk-emails';
import { mapInvitationError } from '@/lib/invitation-errors';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PendingInvitesList } from '@/components/pending-invites-list';
import type { Project, ChangeLogEntry, PendingInvite } from '@/types';

type MemberRole = 'owner' | 'editor' | 'viewer';

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
  // Legacy (flag off) — single email input.
  const [email, setEmail] = useState('');
  // New (flag on) — bulk-paste textarea + per-batch role.
  const [bulkEmails, setBulkEmails] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<SendInvitationEmailResult | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  // tokenId of the pending-invite row whose action is in flight; null
  // otherwise. Disables every row's buttons while one runs.
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  // Confirmation dialogs (replace window.confirm).
  const [revokeTokenId, setRevokeTokenId] = useState<string | null>(null);
  const [removeUid, setRemoveUid] = useState<string | null>(null);

  useEscapeKey(onClose);

  // Focus modal on mount
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  // Load project data
  useEffect(() => {
    let cancelled = false;
    driver.loadProject(projectId).then((p) => {
      if (!cancelled) setProject(p);
    }).catch((err) => {
      console.error('Failed to load project for sharing:', (err as { code?: string }).code ?? 'unknown');
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

  const members: MemberDisplay[] = Object.entries(project?.members ?? {}).map(
    ([uid, role]) => ({ uid, role }),
  );
  const isOwner = !!user && project?.owner === user.uid;

  // ─── Legacy add path (flag off) ────────────────────────────
  const handleAddMemberLegacy = useCallback(async () => {
    if (!db || !project || !user || project.owner !== user.uid) return;
    const trimmedEmail = email.trim().toLowerCase();
    // Validate email format and length (RFC 5321: max 254 chars)
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || trimmedEmail.length > 254) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const q = query(
        collection(db, PROFILES_COL),
        where('email', '==', trimmedEmail),
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setError('User not found. They must sign in at least once before being added.');
        setIsLoading(false);
        return;
      }

      const targetUid = snap.docs[0].id;

      if (project.members?.[targetUid]) {
        setError('This user is already a member of this project.');
        setIsLoading(false);
        return;
      }

      if (targetUid === user.uid) {
        setError('You are already the owner of this project.');
        setIsLoading(false);
        return;
      }

      const updatedMembers = {
        ...project.members,
        [targetUid]: 'editor' as const,
      };

      const changeLogEntry: ChangeLogEntry = {
        action: 'shared',
        timestamp: new Date().toISOString(),
        actor: user.uid,
        detail: `Added ${trimmedEmail} as editor`,
      };

      await setDoc(
        doc(db, PROJECTS_COL, project.id),
        {
          members: updatedMembers,
          _changeLog: appendChangeLogEntry(project._changeLog, changeLogEntry),
        },
        { merge: true },
      );

      setEmail('');
      setSuccess(`Added ${trimmedEmail} as editor.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setIsLoading(false);
    }
  }, [project, email, user]);

  // ─── Invitation add path (flag on) ─────────────────────────
  const handleAddInvitations = useCallback(async () => {
    if (!project || !user || project.owner !== user.uid) return;
    setError(null);
    setSuccess(null);
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

    setIsLoading(true);
    try {
      const data = await callSendInvitationEmail({
        appId: 'spertcfd',
        modelId: project.id,
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
      // The auto-add path mutates the project document; the cloud
      // onProjectChange subscription updates `project` automatically,
      // and the pending-invite list needs an explicit refresh.
      await refreshPending();
    } catch (e) {
      setError(mapInvitationError(e as FirebaseError, 'send'));
    } finally {
      setIsLoading(false);
    }
  }, [project, user, bulkEmails, role, refreshPending]);

  // ─── Pending-invite actions ────────────────────────────────
  const handleResendInvite = useCallback(async (tokenId: string) => {
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

  const handleRevokeConfirm = useCallback(async () => {
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

  // ─── Member-row actions (apply in BOTH flag states) ────────
  const handleRemoveConfirm = useCallback(async () => {
    if (!removeUid || !project) return;
    const targetUid = removeUid;
    setRemoveUid(null);
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
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

  if (!project) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl text-center text-gray-400">
          Loading...
        </div>
      </div>
    );
  }

  // ─── Result chip rendering (flag on) ───────────────────────
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
          {!isOwner && (
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
                  ) : isOwner ? (
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

          {/* Add UI — owner only */}
          {isOwner && (INVITATIONS_ENABLED ? (
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
                disabled={isLoading}
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
                  disabled={isLoading}
                  className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                  aria-label="Role for invitees"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={handleAddInvitations}
                  disabled={isLoading || !bulkEmails.trim()}
                  className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Sending…' : 'Add'}
                </button>
                <span className="text-xs text-gray-400">Max 25 per day.</span>
              </div>
              {renderResultSummary()}
            </>
          ) : (
            <div className="flex gap-2">
              <input
                id="sharing-legacy-email"
                name="sharing-legacy-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddMemberLegacy();
                }}
                placeholder="Email address"
                aria-label="Collaborator email"
                autoComplete="off"
                className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleAddMemberLegacy}
                disabled={!email.trim() || isLoading}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Adding...' : 'Add'}
              </button>
            </div>
          ))}

          {/* Feedback messages */}
          {error && (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          )}
          {success && (
            <p className="mt-2 text-xs text-green-600">{success}</p>
          )}

          {/* Pending invites list (flag-on, owner-only) */}
          {INVITATIONS_ENABLED && isOwner && (
            <div className="mt-4">
              <PendingInvitesList
                pendingInvites={pendingInvites}
                actionBusy={actionBusy}
                onResend={handleResendInvite}
                onRevoke={(tokenId) => setRevokeTokenId(tokenId)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Confirmation dialogs (replace window.confirm) */}
      {revokeTokenId && (
        <ConfirmDialog
          title="Revoke invitation"
          message="The invitee won't be able to claim it after revoke."
          confirmLabel="Revoke"
          variant="danger"
          onConfirm={handleRevokeConfirm}
          onCancel={() => setRevokeTokenId(null)}
        />
      )}
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
