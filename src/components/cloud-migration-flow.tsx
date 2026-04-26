// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

/**
 * Shared cloud-migration UX consumed by both `StorageSection` (Settings tab)
 * and `CloudStorageModal` (auth-chip modal). Owns the local→cloud migration
 * state machine: idle → confirm → migrating → done | error, plus the
 * "Skip" fast-path. Parents trigger it imperatively via the
 * `requestCloudSwitch()` handle method.
 *
 * Scope is deliberately limited to the local→cloud direction. The reverse
 * direction (cloud→local via `SwitchToLocalDialog`) is intentionally NOT
 * extracted: each parent owns its own `SwitchToLocalDialog` orchestration
 * because the two parents differ on a key behavior — `CloudStorageModal`
 * must remain open after the dialog resolves so the user sees the in-place
 * transition to the signed-in-local state, while `StorageSection` simply
 * re-renders without that constraint. Centralizing those handlers would
 * either force a flag on this component or lose the modal's UX. Keep the
 * small duplication; do not "DRY" it without first replacing that contract.
 */

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from 'react';
import { useStorage } from '@/contexts/storage-context';
import { useAuth } from '@/contexts/auth-context';
import { useProjectList } from '@/contexts/project-list-context';
import { createFirestoreDriver } from '@/lib/firestore-driver';
import { migrateLocalToCloud, clearLocalProjects } from '@/lib/cloud-migration';
import { db } from '@/lib/firebase';
import { LS_HAS_UPLOADED } from '@/lib/constants';
import type { Project } from '@/types';

type MigrationState =
  | { status: 'idle' }
  | { status: 'confirm'; localCount: number }
  | { status: 'migrating' }
  | { status: 'done'; uploaded: number; skipped: number }
  | { status: 'error'; message: string };

export interface CloudMigrationFlowProps {
  /**
   * Notification hook fired after the user confirms migration intent — i.e.
   * inside `handleMigrate` (when migration begins) and `handleSkipMigration`.
   * NOT fired from the imperative `requestCloudSwitch()` (which only opens
   * the confirm panel or fast-paths when there's nothing to migrate).
   *
   * Defaulted to a no-op so callers can omit it. Wired but currently unused
   * by both parents — kept per spec for future telemetry / parent-side
   * reactions without another refactor.
   */
  onRequestCloudSwitch?: () => void;
}

export interface CloudMigrationFlowHandle {
  /** Imperatively trigger the cloud-switch flow (opens confirm panel or fast-paths). */
  requestCloudSwitch: () => void;
}

export const CloudMigrationFlow = forwardRef<
  CloudMigrationFlowHandle,
  CloudMigrationFlowProps
>(function CloudMigrationFlow({ onRequestCloudSwitch }, ref) {
  const { switchMode, driver } = useStorage();
  const { user } = useAuth();
  const { projects } = useProjectList();
  const [migration, setMigration] = useState<MigrationState>({ status: 'idle' });
  const [clearLocal, setClearLocal] = useState(false);

  const handleSwitchToCloud = useCallback(() => {
    if (!user || !db) return;

    const hasUploaded = localStorage.getItem(LS_HAS_UPLOADED) === 'true';
    if (hasUploaded) {
      switchMode('cloud');
      return;
    }

    if (projects.length === 0) {
      switchMode('cloud');
      return;
    }

    setMigration({ status: 'confirm', localCount: projects.length });
  }, [user, switchMode, projects]);

  const handleMigrate = useCallback(async () => {
    if (!user || !db) return;
    setMigration({ status: 'migrating' });
    onRequestCloudSwitch?.();

    try {
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
  }, [user, clearLocal, switchMode, projects, driver, onRequestCloudSwitch]);

  const handleSkipMigration = useCallback(() => {
    localStorage.setItem(LS_HAS_UPLOADED, 'true');
    setMigration({ status: 'idle' });
    onRequestCloudSwitch?.();
    switchMode('cloud');
  }, [switchMode, onRequestCloudSwitch]);

  useImperativeHandle(
    ref,
    () => ({
      requestCloudSwitch: () => {
        handleSwitchToCloud();
      },
    }),
    [handleSwitchToCloud],
  );

  if (migration.status === 'idle') return null;

  return (
    <>
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
    </>
  );
});
