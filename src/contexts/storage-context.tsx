// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { createLocalStorageDriver } from '@/lib/local-storage-driver';
import { createFirestoreDriver } from '@/lib/firestore-driver';
import { auth, isFirebaseConfigured, db } from '@/lib/firebase';
import { useAuth } from './auth-context';
import type { StorageDriver, StorageMode } from '@/lib/storage-driver';
import {
  LS_STORAGE_MODE,
  LS_ACTIVE_PROJECT,
  LS_HAS_UPLOADED,
} from '@/lib/constants';
import { INDEX_KEY, PROJECT_PREFIX, loadIndex } from '@/lib/storage';
import { registerSignOutCleanup } from '@/lib/sign-out-cleanup-registry';
import { runDataReset } from '@/lib/app-data-reset-registry';

interface StorageContextValue {
  driver: StorageDriver;
  mode: StorageMode;
  /** Switch between local and cloud storage modes. */
  switchMode: (newMode: StorageMode) => void;
  /** Whether Firebase is configured and available. */
  isCloudAvailable: boolean;
  /** True when the driver is ready to use. False while waiting for cloud auth. */
  storageReady: boolean;
}

const StorageContext = createContext<StorageContextValue | null>(null);

export function useStorage(): StorageContextValue {
  const ctx = useContext(StorageContext);
  if (!ctx) {
    throw new Error('useStorage must be used within StorageProvider');
  }
  return ctx;
}

function getPersistedMode(): StorageMode {
  if (typeof window === 'undefined') return 'local';
  const stored = localStorage.getItem(LS_STORAGE_MODE);
  return stored === 'cloud' ? 'cloud' : 'local';
}

export function StorageProvider({ children }: { children: ReactNode }) {
  const { user, isAuthLoading } = useAuth();
  const [persistedMode, setPersistedMode] = useState<StorageMode>(getPersistedMode);

  // Auth-aware loading gate:
  // If persisted mode is 'cloud', don't create a driver until auth resolves.
  // This prevents a flash of local data before cloud data loads.
  const isCloudPending =
    persistedMode === 'cloud' && isFirebaseConfigured && isAuthLoading;

  // Resolve effective mode: cloud only if Firebase available + signed in + user chose cloud
  const effectiveMode: StorageMode =
    isFirebaseConfigured && user && persistedMode === 'cloud' ? 'cloud' : 'local';

  // driverRef tracks the current driver for performSignOutWithCleanup.
  // Updated atomically inside every setDriver call (never in a follow-up
  // useEffect — that would leave a one-render stale-ref window when
  // sign-out fires during a concurrent render).
  const driverRef = useRef<StorageDriver | null>(null);

  // Use useState with lazy initializer (not useMemo) to prevent infinite re-render.
  // See GanttApp APP-STATUS.md lessons learned. driverRef is populated by
  // the driver-swap useEffect on first run; it is briefly null on the very
  // first render but sign-out cannot be invoked before auth resolves.
  const [driver, setDriver] = useState<StorageDriver | null>(() => {
    if (persistedMode === 'cloud' && isFirebaseConfigured) {
      return null; // Wait for auth to resolve
    }
    return createLocalStorageDriver();
  });

  const storageReady = driver !== null && !isCloudPending;

  // Update driver when auth resolves or mode changes
  useEffect(() => {
    // Still waiting for auth — don't create a driver yet
    if (isAuthLoading && persistedMode === 'cloud' && isFirebaseConfigured) {
      return;
    }

    if (effectiveMode === 'cloud' && user && db) {
      // Swap to cloud driver. If the user is still present, flush old
      // pending writes (credentials still valid). If user is null (sign-
      // out path), cancelPendingSaves was already called by
      // performSignOutWithCleanup — do nothing further.
      const firestore = db; // narrow for closure
      setDriver((prev) => {
        if (user) prev?.flush();
        const next = createFirestoreDriver(user.uid, firestore);
        driverRef.current = next;
        return next;
      });
    } else {
      setDriver((prev) => {
        // Only flush if user is still present. On sign-out
        // (user === null), performSignOutWithCleanup already cancelled
        // pending writes; flushing would fire setDoc with revoked creds.
        if (user) prev?.flush();
        const next = createLocalStorageDriver();
        driverRef.current = next;
        return next;
      });
    }
  }, [isAuthLoading, effectiveMode, user, persistedMode]);

  // Flush pending writes on unmount — only when credentials are still
  // valid. If user became null (sign-out), pending writes were already
  // cancelled by performSignOutWithCleanup.
  useEffect(() => {
    return () => {
      if (user) driver?.flush();
    };
  }, [driver, user]);

  const switchMode = useCallback((newMode: StorageMode) => {
    localStorage.setItem(LS_STORAGE_MODE, newMode);
    setPersistedMode(newMode);
  }, []);

  // Register sign-out cleanup. The registered function closes over
  // driverRef, not `driver` — it reads driverRef.current at invocation
  // time, which reflects the driver current at the moment of sign-out.
  useEffect(() => {
    const performSignOutWithCleanup = async (): Promise<void> => {
      // 1. Zero in-memory state synchronously — prevents prior user's
      //    projects from flashing in the UI during the auth cascade.
      runDataReset();

      // 2. Cancel pending Firestore writes BEFORE credentials revoke.
      driverRef.current?.cancelPendingSaves();

      // 3. Clear per-user localStorage keys. Per-browser carve-outs
      //    (LS_STORAGE_MODE, LS_TOS_ACCEPTED_VERSION, LS_WORKSPACE_ID,
      //    LS_FIRST_RUN_SEEN, LS_SUPPRESS_LS_WARNING) are preserved.
      if (typeof window !== 'undefined') {
        localStorage.removeItem(LS_ACTIVE_PROJECT);
        localStorage.removeItem(LS_HAS_UPLOADED);
        const index = loadIndex();
        for (const id of index.projectIds) {
          localStorage.removeItem(PROJECT_PREFIX + id);
        }
        localStorage.removeItem(INDEX_KEY);
      }

      // 4. Revoke credentials. onAuthStateChanged(null) fires, cascading
      //    setUser(null) → effectiveMode → 'local' → driver swap.
      if (auth) {
        await firebaseSignOut(auth);
      }
    };

    return registerSignOutCleanup(performSignOutWithCleanup);
  }, []);

  // Block children until driver is ready (Issue 6 — loading gate)
  // StorageProvider must not render children when !storageReady, which
  // prevents ProjectListContext from mounting before the driver exists.
  if (!storageReady || !driver) {
    return (
      <StorageContext.Provider
        value={{
          driver: driver!,
          mode: effectiveMode,
          switchMode,
          isCloudAvailable: isFirebaseConfigured,
          storageReady: false,
        }}
      >
        <div className="flex h-screen items-center justify-center text-gray-400">
          Loading...
        </div>
      </StorageContext.Provider>
    );
  }

  return (
    <StorageContext.Provider
      value={{
        driver,
        mode: effectiveMode,
        switchMode,
        isCloudAvailable: isFirebaseConfigured,
        storageReady: true,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}
