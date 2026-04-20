// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState, useCallback } from 'react';
import { useStorage } from '@/contexts/storage-context';
import { useAuth } from '@/contexts/auth-context';
import { useProjectList } from '@/contexts/project-list-context';
import { createLocalStorageDriver } from '@/lib/local-storage-driver';
import { createFirestoreDriver } from '@/lib/firestore-driver';
import { migrateLocalToCloud, clearLocalProjects } from '@/lib/cloud-migration';
import { db } from '@/lib/firebase';
import { LS_HAS_UPLOADED, LS_ACTIVE_PROJECT } from '@/lib/constants';
import { SwitchToLocalDialog } from './switch-to-local-dialog';
import type { Project } from '@/types';

type MigrationState =
  | { status: 'idle' }
  | { status: 'confirm'; localCount: number }
  | { status: 'migrating' }
  | { status: 'done'; uploaded: number; skipped: number }
  | { status: 'error'; message: string };

export function StorageSection() {
  const { mode, switchMode, isCloudAvailable, driver } = useStorage();
  const {
    user,
    signInWithGoogle,
    signInWithMicrosoft,
    signOut,
    signInError,
    clearSignInError,
  } = useAuth();
  const { projects } = useProjectList();
  const [migration, setMigration] = useState<MigrationState>({ status: 'idle' });
  const [clearLocal, setClearLocal] = useState(false);
  const [showSwitchToLocalConfirm, setShowSwitchToLocalConfirm] = useState(false);

  const handleSwitchToCloud = useCallback(async () => {
    if (!user || !db) return;

    // Check if we've already uploaded — skip migration dialog
    const hasUploaded = localStorage.getItem(LS_HAS_UPLOADED) === 'true';
    if (hasUploaded) {
      switchMode('cloud');
      return;
    }

    // Read local project count from the in-memory list (C3 fix).
    if (projects.length === 0) {
      switchMode('cloud');
      return;
    }

    setMigration({ status: 'confirm', localCount: projects.length });
  }, [user, switchMode, projects]);

  const handleMigrate = useCallback(async () => {
    if (!user || !db) return;
    setMigration({ status: 'migrating' });

    try {
      // Source projects from in-memory list + current local driver (C3 fix).
      // handleMigrate runs while mode is still 'local', so useStorage().driver
      // is the local driver.
      const localDriver = driver;
      const fullProjects: Project[] = [];
      for (const p of projects) {
        const full = await localDriver.loadProject(p.id);
        if (full) fullProjects.push(full);
      }

      const cloudDriver = createFirestoreDriver(user.uid, db);
      const result = await migrateLocalToCloud(
        user.uid,
        db,
        fullProjects,
        cloudDriver,
      );

      localStorage.setItem(LS_HAS_UPLOADED, 'true');

      if (clearLocal) {
        await clearLocalProjects(localDriver);
      }

      setMigration({ status: 'done', ...result });
      switchMode('cloud');
    } catch (err) {
      setMigration({
        status: 'error',
        message: err instanceof Error ? err.message : 'Migration failed',
      });
    }
  }, [user, clearLocal, switchMode, projects, driver]);

  const handleSkipMigration = useCallback(() => {
    localStorage.setItem(LS_HAS_UPLOADED, 'true');
    setMigration({ status: 'idle' });
    switchMode('cloud');
  }, [switchMode]);

  const handleLocalModeClick = useCallback(() => {
    if (mode !== 'cloud') {
      // Already local; nothing to preserve or discard.
      return;
    }
    if (projects.length === 0) {
      switchMode('local');
      return;
    }
    setShowSwitchToLocalConfirm(true);
  }, [mode, projects.length, switchMode]);

  const handleKeepLocalCopy = useCallback(async () => {
    // Copy in-memory cloud projects to localStorage via a new local
    // driver. Must read from the CURRENT (cloud) driver because after
    // switchMode('local') the driver swaps and cloud-only data is gone.
    const localDriver = createLocalStorageDriver();
    for (const p of projects) {
      try {
        const full = await driver.loadProject(p.id);
        if (full) {
          await localDriver.createProject(full);
        }
      } catch (err) {
        console.error(
          'Failed to copy project to local storage:',
          (err as { code?: string }).code ?? 'unknown',
        );
      }
    }
    localStorage.removeItem(LS_ACTIVE_PROJECT);
    setShowSwitchToLocalConfirm(false);
    switchMode('local');
  }, [projects, driver, switchMode]);

  const handleDiscard = useCallback(() => {
    localStorage.removeItem(LS_ACTIVE_PROJECT);
    setShowSwitchToLocalConfirm(false);
    switchMode('local');
  }, [switchMode]);

  const handleCancelSwitch = useCallback(() => {
    setShowSwitchToLocalConfirm(false);
  }, []);

  return (
    <section className="mb-8">
      <h3 className="text-lg font-semibold mb-3 text-gray-900">Storage</h3>

      {/* Current mode display */}
      <div className="flex gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="storage-mode"
            checked={mode === 'local'}
            onChange={handleLocalModeClick}
            className="accent-blue-600"
          />
          Local Storage
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="storage-mode"
            checked={mode === 'cloud'}
            onChange={() => {
              if (user) {
                handleSwitchToCloud();
              }
            }}
            disabled={!isCloudAvailable || !user}
            className="accent-blue-600"
          />
          Cloud Storage
          {!isCloudAvailable && (
            <span className="text-xs text-gray-400">(not configured)</span>
          )}
        </label>
      </div>

      {/* Auth section */}
      {isCloudAvailable && (
        <div className="mb-4">
          {user ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-600">
                Signed in as <strong>{user.displayName ?? user.email}</strong>
              </span>
              <button
                onClick={signOut}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-500 mb-1">
                Sign in to enable Cloud Storage:
              </p>
              <div className="flex gap-2">
                <button
                  onClick={signInWithGoogle}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                >
                  Sign in with Google
                </button>
                <button
                  onClick={signInWithMicrosoft}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                >
                  Sign in with Microsoft
                </button>
              </div>
              {signInError && (
                <div
                  role="alert"
                  className="mt-2 flex items-center justify-between rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                >
                  <span>{signInError}</span>
                  <button
                    onClick={clearSignInError}
                    className="ml-3 text-amber-700 hover:text-amber-900 underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Migration dialog */}
      {migration.status === 'confirm' && (
        <div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm">
          <p className="mb-3 text-blue-800">
            You have <strong>{migration.localCount}</strong> local project
            {migration.localCount !== 1 ? 's' : ''}. Upload to cloud?
          </p>
          <label className="flex items-center gap-2 mb-3 text-blue-700">
            <input
              type="checkbox"
              checked={clearLocal}
              onChange={(e) => setClearLocal(e.target.checked)}
            />
            Clear local copies after upload
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleMigrate}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
            >
              Upload
            </button>
            <button
              onClick={handleSkipMigration}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {migration.status === 'migrating' && (
        <div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Uploading projects to cloud...
        </div>
      )}

      {migration.status === 'done' && (
        <div className="rounded border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Migration complete: {migration.uploaded} uploaded, {migration.skipped} skipped.
        </div>
      )}

      {migration.status === 'error' && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Migration failed: {migration.message}
          <button
            onClick={() => setMigration({ status: 'idle' })}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Cloud → Local switch confirmation */}
      {showSwitchToLocalConfirm && (
        <SwitchToLocalDialog
          projectCount={projects.length}
          onKeepLocalCopy={handleKeepLocalCopy}
          onDiscard={handleDiscard}
          onCancel={handleCancelSwitch}
        />
      )}
    </section>
  );
}
