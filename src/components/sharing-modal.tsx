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
import { X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useStorage } from '@/contexts/storage-context';
import { useEscapeKey } from '@/lib/use-dismiss';
import { PROJECTS_COL, PROFILES_COL, appendChangeLogEntry } from '@/lib/firestore-helpers';
import type { Project, ChangeLogEntry } from '@/types';

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
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const members: MemberDisplay[] = Object.entries(project?.members ?? {}).map(
    ([uid, role]) => ({ uid, role }),
  );
  const isOwner = !!user && project?.owner === user.uid;

  const handleAddMember = useCallback(async () => {
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

  const handleRemoveMember = useCallback(
    async (targetUid: string) => {
      if (!db || !project || !user || project.owner !== user.uid) return;

      const updatedMembers = { ...project.members };
      delete updatedMembers[targetUid];

      await setDoc(
        doc(db, PROJECTS_COL, project.id),
        { members: updatedMembers },
        { merge: true },
      );
    },
    [project, user],
  );

  const handleChangeRole = useCallback(
    async (targetUid: string, newRole: MemberRole) => {
      if (!db || !project || !user || project.owner !== user.uid) return;

      const updatedMembers = {
        ...project.members,
        [targetUid]: newRole,
      };

      await setDoc(
        doc(db, PROJECTS_COL, project.id),
        { members: updatedMembers },
        { merge: true },
      );
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
                        value={m.role}
                        onChange={(e) =>
                          handleChangeRole(m.uid, e.target.value as MemberRole)
                        }
                        className="rounded border border-gray-300 px-1 py-0.5 text-xs"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => handleRemoveMember(m.uid)}
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

          {/* Add member form (owner only) */}
          {isOwner && (
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddMember();
                }}
                placeholder="Email address"
                className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleAddMember}
                disabled={!email.trim() || isLoading}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Adding...' : 'Add'}
              </button>
            </div>
          )}

          {/* Feedback messages */}
          {error && (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          )}
          {success && (
            <p className="mt-2 text-xs text-green-600">{success}</p>
          )}
        </div>
      </div>
    </div>
  );
}
