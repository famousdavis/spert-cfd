// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerDataReset,
  runDataReset,
} from '../app-data-reset-registry';

beforeEach(() => {
  // Drain the module-level Set by registering a sentinel and immediately
  // unregistering everything we added during the prior test. The cleanest
  // approach is to register no-ops repeatedly until a known signal.
  // Since registerDataReset returns an unregister, each test uses its
  // own unregister handles.
});

describe('appDataResetRegistry', () => {
  it('runDataReset calls every registered fn', () => {
    const a = vi.fn();
    const b = vi.fn();
    const ua = registerDataReset(a);
    const ub = registerDataReset(b);

    runDataReset();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    ua();
    ub();
  });

  it('runDataReset continues if one fn throws', () => {
    const throwing = vi.fn(() => {
      throw new Error('boom');
    });
    const ok = vi.fn();
    const u1 = registerDataReset(throwing);
    const u2 = registerDataReset(ok);

    expect(() => runDataReset()).not.toThrow();
    expect(ok).toHaveBeenCalledTimes(1);

    u1();
    u2();
  });

  it('unregister removes the fn from the registry', () => {
    const a = vi.fn();
    const u = registerDataReset(a);
    u();
    runDataReset();
    expect(a).not.toHaveBeenCalled();
  });

  it('runDataReset with empty registry is a no-op', () => {
    expect(() => runDataReset()).not.toThrow();
  });

  it('double-registration is idempotent', () => {
    const a = vi.fn();
    const u1 = registerDataReset(a);
    const u2 = registerDataReset(a);
    runDataReset();
    // Set dedupes — called exactly once.
    expect(a).toHaveBeenCalledTimes(1);
    u1();
    u2();
  });
});
