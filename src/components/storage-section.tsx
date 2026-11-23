// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

"use client";

import { useCallback, useRef, useState } from "react";
import { useStorage } from "@/contexts/storage-context";
import { useAuth } from "@/contexts/auth-context";
import { useProjectList } from "@/contexts/project-list-context";
import { keepLocalCopy } from "@/lib/keep-local-copy";
import { LS_ACTIVE_PROJECT } from "@/lib/constants";
import { SwitchToLocalDialog } from "./switch-to-local-dialog";
import {
  CloudMigrationFlow,
  type CloudMigrationFlowHandle,
} from "./cloud-migration-flow";

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
  const migrationRef = useRef<CloudMigrationFlowHandle>(null);
  const [showSwitchToLocalConfirm, setShowSwitchToLocalConfirm] =
    useState(false);

  const handleLocalModeClick = useCallback(() => {
    if (mode !== "cloud") {
      // Already local; nothing to preserve or discard.
      return;
    }
    if (projects.length === 0) {
      switchMode("local");
      return;
    }
    setShowSwitchToLocalConfirm(true);
  }, [mode, projects.length, switchMode]);

  const handleKeepLocalCopy = useCallback(async () => {
    // Copy in-memory cloud projects to localStorage via a new local
    // driver. Must read from the CURRENT (cloud) driver because after
    // switchMode('local') the driver swaps and cloud-only data is gone.
    // v0.21.0 (DASH26 R36): the projects and, for those copied, the person's
    // tile colours and archive (keep-local-copy.ts).
    await keepLocalCopy(projects, driver);
    localStorage.removeItem(LS_ACTIVE_PROJECT);
    setShowSwitchToLocalConfirm(false);
    switchMode("local");
  }, [projects, driver, switchMode]);

  const handleDiscard = useCallback(() => {
    localStorage.removeItem(LS_ACTIVE_PROJECT);
    setShowSwitchToLocalConfirm(false);
    switchMode("local");
  }, [switchMode]);

  const handleCancelSwitch = useCallback(() => {
    setShowSwitchToLocalConfirm(false);
  }, []);

  return (
    <section className="mb-8">
      <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Storage</h3>

      {/* Current mode display */}
      <div className="flex gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm dark:text-gray-200">
          <input
            type="radio"
            name="storage-mode"
            checked={mode === "local"}
            onChange={handleLocalModeClick}
            className="accent-blue-600"
          />
          Local Storage
        </label>
        <label className="flex items-center gap-2 text-sm dark:text-gray-200">
          <input
            type="radio"
            name="storage-mode"
            checked={mode === "cloud"}
            onChange={() => {
              if (user) {
                migrationRef.current?.requestCloudSwitch();
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
              <span className="text-gray-600 dark:text-gray-400">
                Signed in as <strong>{user.displayName ?? user.email}</strong>
              </span>
              <button
                onClick={signOut}
                className="rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-2 py-1 text-xs text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Sign in to enable Cloud Storage:
              </p>
              <div className="flex gap-2">
                <button
                  onClick={signInWithGoogle}
                  className="rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  Sign in with Google
                </button>
                <button
                  onClick={signInWithMicrosoft}
                  className="rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  Sign in with Microsoft
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Microsoft sign-in requires a work or school account. For a
                personal account, use Google.
              </p>
              {signInError && (
                <div
                  role="alert"
                  className="mt-2 flex items-center justify-between rounded border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
                >
                  <span>{signInError}</span>
                  <button
                    onClick={clearSignInError}
                    className="ml-3 text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cloud migration flow (local → cloud direction). The reverse
          direction lives inline below — see SwitchToLocalDialog rationale
          in cloud-migration-flow.tsx's JSDoc. */}
      <CloudMigrationFlow ref={migrationRef} />

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
