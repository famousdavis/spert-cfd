// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerSignOutCleanup,
  runSignOutCleanup,
} from '../sign-out-cleanup-registry';

beforeEach(() => {
  // Reset the registry between tests by registering a no-op and then
  // calling its unregister.
  const unregister = registerSignOutCleanup(async () => {});
  unregister();
});

describe('signOutCleanupRegistry', () => {
  it('runSignOutCleanup resolves when nothing is registered', async () => {
    await expect(runSignOutCleanup()).resolves.toBeUndefined();
  });

  it('runSignOutCleanup awaits the registered fn', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    registerSignOutCleanup(fn);
    await runSignOutCleanup();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('runSignOutCleanup propagates rejection from the registered fn', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    registerSignOutCleanup(fn);
    await expect(runSignOutCleanup()).rejects.toThrow('boom');
  });

  it('registerSignOutCleanup returns an unregister fn that nulls the slot', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const unregister = registerSignOutCleanup(fn);
    unregister();
    await runSignOutCleanup();
    expect(fn).not.toHaveBeenCalled();
  });

  it('unregister is a no-op if a different fn is now registered', async () => {
    const fn1 = vi.fn().mockResolvedValue(undefined);
    const fn2 = vi.fn().mockResolvedValue(undefined);
    const unregister1 = registerSignOutCleanup(fn1);
    registerSignOutCleanup(fn2);
    // fn1's unregister must NOT null the slot since fn2 is now registered.
    unregister1();
    await runSignOutCleanup();
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledTimes(1);
  });
});
