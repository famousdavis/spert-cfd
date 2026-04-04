// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useCallback } from 'react';
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useActiveProject } from '@/contexts/active-project-context';
import { PROJECTS_COL, PROFILES_COL, appendChangeLogEntry } from '@/lib/firestore-helpers';
import type { ChangeLogEntry } from '@/types';

type MemberRole = 'owner' | 'editor' | 'viewer';

interface MemberDisplay {
  uid: string;
  role: MemberRole;
}

export function SharingSection() {
  const { user } = useAuth();
  const { project } = useActiveProject();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Guard: only shown in cloud mode for projects the current user owns
  if (!project || !user || !db) return null;

  const members: MemberDisplay[] = Object.entries(project.members ?? {}).map(
    ([uid, role]) => ({ uid, role }),
  );
  const isOwner = project.owner === user.uid;

  const handleAddMember = useCallback(async () => {
    if (!db || !project || !email.trim()) return;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      // Look up user by email in profiles collection
      const q = query(
        collection(db, PROFILES_COL),
        where('email', '==', email.trim().toLowerCase()),
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setError('User not found. They must sign in at least once before being added.');
        setIsLoading(false);
        return;
      }

      const targetUid = snap.docs[0].id;

      // Check if already a member
      if (project.members?.[targetUid]) {
        setError('This user is already a member of this project.');
        setIsLoading(false);
        return;
      }

      // Can't add yourself
      if (targetUid === user!.uid) {
        setError('You are already the owner of this project.');
        setIsLoading(false);
        return;
      }

      // Add as editor by default
      const updatedMembers = {
        ...project.members,
        [targetUid]: 'editor' as const,
      };

      const changeLogEntry: ChangeLogEntry = {
        action: 'shared',
        timestamp: new Date().toISOString(),
        actor: user!.uid,
        detail: `Added ${email.trim()} as editor`,
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
      setSuccess(`Added ${email.trim()} as editor.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setIsLoading(false);
    }
  }, [db, project, email, user]);

  const handleRemoveMember = useCallback(
    async (targetUid: string) => {
      if (!db || !project) return;

      const updatedMembers = { ...project.members };
      delete updatedMembers[targetUid];

      await setDoc(
        doc(db, PROJECTS_COL, project.id),
        { members: updatedMembers },
        { merge: true },
      );
    },
    [project],
  );

  const handleChangeRole = useCallback(
    async (targetUid: string, newRole: MemberRole) => {
      if (!db || !project) return;

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
    [project],
  );

  if (!isOwner) {
    return (
      <section className="mb-8">
        <h3 className="text-lg font-semibold mb-3 text-gray-900">Sharing</h3>
        <p className="text-sm text-gray-500">
          Only the project owner can manage sharing settings.
        </p>
        <div className="mt-2">
          <span className="text-xs text-gray-400">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h3 className="text-lg font-semibold mb-3 text-gray-900">
        Sharing — {project.name}
      </h3>

      {/* Member list */}
      <div className="mb-4 space-y-2">
        {members.map((m) => (
          <div
            key={m.uid}
            className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm"
          >
            <span className="text-gray-700">
              {m.uid === user.uid ? 'You' : m.uid}
            </span>
            <div className="flex items-center gap-2">
              {m.role === 'owner' ? (
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                  Owner
                </span>
              ) : (
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
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add member form */}
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

      {/* Feedback messages */}
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
      {success && (
        <p className="mt-2 text-xs text-green-600">{success}</p>
      )}
    </section>
  );
}
