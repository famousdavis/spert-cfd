// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useStorage } from '@/contexts/storage-context';
import { useProjectList } from '@/contexts/project-list-context';
import { createLocalStorageDriver } from '@/lib/local-storage-driver';
import { useEscapeKey } from '@/lib/use-dismiss';
import { normalizeDisplayName } from '@/lib/user-display';
import { LS_ACTIVE_PROJECT, LS_SUPPRESS_LS_WARNING } from '@/lib/constants';
import { GoogleLogo } from './icons/google-logo';
import { MicrosoftLogo } from './icons/microsoft-logo';
import { SwitchToLocalDialog } from './switch-to-local-dialog';
import {
  CloudMigrationFlow,
  type CloudMigrationFlowHandle,
} from './cloud-migration-flow';

interface CloudStorageModalProps {
  open: boolean;
  onClose: () => void;
}

const TITLE_ID = 'cloud-storage-modal-title';

export function CloudStorageModal({ open, onClose }: CloudStorageModalProps) {
  const {
    user,
    signInWithGoogle,
    signInWithMicrosoft,
    signOut,
    signInError,
    clearSignInError,
  } = useAuth();
  const { mode, switchMode, isCloudAvailable, driver } = useStorage();
  const { projects } = useProjectList();

  const migrationRef = useRef<CloudMigrationFlowHandle>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [showSwitchToLocalConfirm, setShowSwitchToLocalConfirm] = useState(false);
  const [notifyOnLocalStartup, setNotifyOnLocalStartup] = useState(true);

  // Hydrate the Notifications toggle from localStorage post-mount (SSR safe).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setNotifyOnLocalStartup(
      localStorage.getItem(LS_SUPPRESS_LS_WARNING) !== 'true',
    );
  }, [open]);

  const guardedClose = useCallback(() => {
    if (signingOut) return;
    onClose();
  }, [signingOut, onClose]);

  useEscapeKey(
    useCallback(() => {
      if (open) guardedClose();
    }, [open, guardedClose]),
  );

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      onClose();
    } catch (err) {
      console.error('Sign-out error:', err);
    } finally {
      setSigningOut(false);
    }
  }, [signingOut, signOut, onClose]);

  const handleKeepLocalCopy = useCallback(async () => {
    // Mirror StorageSection's keep-local handler, but leave the modal open
    // so the user sees the in-place transition to the signed-in-local state.
    // See JSDoc in cloud-migration-flow.tsx for why this is duplicated.
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

  const handleNotifyToggle = useCallback((next: boolean) => {
    setNotifyOnLocalStartup(next);
    if (next) {
      localStorage.removeItem(LS_SUPPRESS_LS_WARNING);
    } else {
      localStorage.setItem(LS_SUPPRESS_LS_WARNING, 'true');
    }
  }, []);

  if (!open) return null;

  const isSignedIn = !!user;
  const fullName = normalizeDisplayName(user?.displayName);
  const emailLocal = user?.email?.split('@')[0] ?? '';
  const identityPrimary = fullName || emailLocal;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) guardedClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 id={TITLE_ID} className="text-base font-semibold text-gray-900">
            Cloud Storage
          </h2>
          <button
            type="button"
            onClick={guardedClose}
            disabled={signingOut}
            aria-label="Close"
            className="rounded p-1 text-gray-400 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          {/* Storage section */}
          <section className="mb-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Storage</h3>

            <div className="flex flex-col gap-2 mb-3">
              <label
                className={`flex items-center gap-2 text-sm ${
                  !isSignedIn ? 'text-gray-900' : ''
                }`}
              >
                <input
                  type="radio"
                  name="cloud-modal-storage-mode"
                  checked={mode === 'local'}
                  disabled={!isSignedIn}
                  onChange={() => {
                    if (isSignedIn && mode === 'cloud') {
                      setShowSwitchToLocalConfirm(true);
                    }
                  }}
                  className="accent-blue-600"
                />
                Local (browser only)
              </label>
              <label
                className={`flex items-center gap-2 text-sm ${
                  !isSignedIn ? 'opacity-50 text-gray-500' : 'text-gray-900'
                }`}
              >
                <input
                  type="radio"
                  name="cloud-modal-storage-mode"
                  checked={mode === 'cloud'}
                  disabled={!isSignedIn || !isCloudAvailable}
                  onChange={() => {
                    if (isSignedIn && mode === 'local') {
                      migrationRef.current?.requestCloudSwitch();
                    }
                  }}
                  className="accent-blue-600"
                />
                Cloud (sync across devices)
              </label>
            </div>

            {/* State 1: Signed out */}
            {!isSignedIn && (
              <div>
                <p className="text-xs text-gray-500 mb-3">
                  Sign in to enable cloud storage and sharing.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    className="flex-1 min-w-[140px] inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <GoogleLogo />
                    <span>Sign in with Google</span>
                  </button>
                  <button
                    type="button"
                    onClick={signInWithMicrosoft}
                    className="flex-1 min-w-[140px] inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <MicrosoftLogo />
                    <span>Sign in with Microsoft</span>
                  </button>
                </div>
                {signInError && (
                  <div
                    role="alert"
                    className="mt-3 flex items-center justify-between rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                  >
                    <span>{signInError}</span>
                    <button
                      type="button"
                      onClick={clearSignInError}
                      className="ml-3 underline hover:text-red-900"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* States 2 and 3: Signed in (identity card + actions) */}
            {isSignedIn && user && (
              <>
                <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between mb-3">
                  <div className="min-w-0 mr-3">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {identityPrimary || 'Signed in'}
                    </div>
                    {user.email && (
                      <div className="text-xs text-gray-500 truncate">
                        {user.email}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="text-sm text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
                  >
                    {signingOut ? 'Signing out…' : 'Sign out'}
                  </button>
                </div>

                {/* State 2 only: migration flow + "Keep using local storage" */}
                {mode === 'local' && (
                  <>
                    <CloudMigrationFlow ref={migrationRef} />
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-3 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Keep using local storage
                    </button>
                  </>
                )}
              </>
            )}
          </section>

          {/* Notifications section */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Notifications
            </h3>
            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <div className="min-w-0">
                <div className="text-sm text-gray-900">
                  Warn me on startup when using local storage
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Shows a caution banner each time the app opens while your
                  data is stored locally in this browser.
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifyOnLocalStartup}
                onChange={(e) => handleNotifyToggle(e.target.checked)}
                className="mt-1 accent-blue-600 h-4 w-4 shrink-0"
              />
            </label>
          </section>
        </div>
      </div>

      {/* Cloud → Local switch confirmation (State 3 trigger). Stays inside
          the modal tree so dismissing the dialog leaves this modal open. */}
      {showSwitchToLocalConfirm && (
        <SwitchToLocalDialog
          projectCount={projects.length}
          onKeepLocalCopy={handleKeepLocalCopy}
          onDiscard={handleDiscard}
          onCancel={handleCancelSwitch}
        />
      )}
    </div>
  );
}
