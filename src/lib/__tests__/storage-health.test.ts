import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStorageUsage,
  WARNING_THRESHOLD,
  CRITICAL_THRESHOLD,
} from '../storage-health';

// ── localStorage mock ────────────────────────────────────

let store: Record<string, string> = {};

const localStorageMock: Storage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    store = {};
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

Object.defineProperty(globalThis, 'window', {
  value: { localStorage: localStorageMock },
  writable: true,
});

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  store = {};
});

// ── Tests ────────────────────────────────────────────────

describe('getStorageUsage', () => {
  it('returns 0 bytes when storage is empty', () => {
    const usage = getStorageUsage();
    expect(usage.bytes).toBe(0);
    expect(usage.percent).toBe(0);
    expect(usage.status).toBe('ok');
  });

  it('counts bytes for matching keys only', () => {
    store['cfd-lab'] = 'x'.repeat(100);
    store['cfd-lab-project-abc'] = 'y'.repeat(200);
    store['unrelated-key'] = 'z'.repeat(9999);

    const usage = getStorageUsage();
    expect(usage.bytes).toBeGreaterThan(0);
    // Should not include the unrelated key's size
    const unrelatedSize = ('unrelated-key'.length + 9999) * 2;
    expect(usage.bytes).toBeLessThan(unrelatedSize);
  });

  it('reports ok status for small usage', () => {
    store['cfd-lab'] = 'x'.repeat(100);
    const usage = getStorageUsage();
    expect(usage.status).toBe('ok');
  });
});

describe('thresholds', () => {
  it('has correct warning threshold at 3MB', () => {
    expect(WARNING_THRESHOLD).toBe(3 * 1024 * 1024);
  });

  it('has correct critical threshold at 4.5MB', () => {
    expect(CRITICAL_THRESHOLD).toBe(4.5 * 1024 * 1024);
  });
});
