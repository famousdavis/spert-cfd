// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { createLocalStorageDriver } from '@/lib/local-storage-driver';
import type { StorageDriver, StorageMode } from '@/lib/storage-driver';

interface StorageContextValue {
  driver: StorageDriver;
  mode: StorageMode;
  /** True when the driver is ready to use. Always true in v0.6.0. */
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

export function StorageProvider({ children }: { children: ReactNode }) {
  // Use useState with lazy initializer (not useMemo) to create the driver once.
  // Without the lazy form, a new instance is created on every render, which
  // triggers infinite re-render loops if consuming contexts have [driver] as
  // a useEffect dependency. Lesson learned from GanttApp POC.
  const [driver] = useState<StorageDriver>(() => createLocalStorageDriver());

  // Flush pending writes on unmount
  useEffect(() => {
    return () => driver.flush();
  }, [driver]);

  return (
    <StorageContext.Provider
      value={{
        driver,
        mode: driver.mode,
        storageReady: true,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}
