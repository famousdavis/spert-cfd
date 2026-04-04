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
  type ReactNode,
} from 'react';
import { createLocalStorageDriver } from '@/lib/local-storage-driver';
import { createFirestoreDriver } from '@/lib/firestore-driver';
import { isFirebaseConfigured, db } from '@/lib/firebase';
import { useAuth } from './auth-context';
import type { StorageDriver, StorageMode } from '@/lib/storage-driver';
import { LS_STORAGE_MODE } from '@/lib/constants';

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

  // Use useState with lazy initializer (not useMemo) to prevent infinite re-render.
  // See GanttApp APP-STATUS.md lessons learned.
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
      // Flush old driver before swapping
      const firestore = db; // narrow for closure
      // eslint-disable-next-line react-hooks/set-state-in-effect -- driver swap requires flush + create
      setDriver((prev) => {
        prev?.flush();
        return createFirestoreDriver(user.uid, firestore);
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- driver swap requires flush + create
      setDriver((prev) => {
        prev?.flush();
        return createLocalStorageDriver();
      });
    }
  }, [isAuthLoading, effectiveMode, user, persistedMode]);

  // Flush pending writes on unmount
  useEffect(() => {
    return () => driver?.flush();
  }, [driver]);

  const switchMode = useCallback((newMode: StorageMode) => {
    localStorage.setItem(LS_STORAGE_MODE, newMode);
    setPersistedMode(newMode);
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
