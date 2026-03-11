// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  hasAcceptedCurrentTos,
  recordLocalAcceptance,
  setWritePending,
  consumeWritePending,
  clearLocalConsent,
} from '../consent';
import { LS_TOS_ACCEPTED_VERSION, LS_TOS_WRITE_PENDING, TOS_VERSION } from '../constants';

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

describe('consent utilities', () => {
  beforeEach(() => {
    store = {};
  });

  describe('hasAcceptedCurrentTos', () => {
    it('returns false when no key exists', () => {
      expect(hasAcceptedCurrentTos()).toBe(false);
    });

    it('returns true when key matches TOS_VERSION', () => {
      localStorage.setItem(LS_TOS_ACCEPTED_VERSION, TOS_VERSION);
      expect(hasAcceptedCurrentTos()).toBe(true);
    });

    it('returns false when key is a different version', () => {
      localStorage.setItem(LS_TOS_ACCEPTED_VERSION, '01-01-2020');
      expect(hasAcceptedCurrentTos()).toBe(false);
    });
  });

  describe('recordLocalAcceptance', () => {
    it('sets the correct key and value', () => {
      recordLocalAcceptance();
      expect(localStorage.getItem(LS_TOS_ACCEPTED_VERSION)).toBe(TOS_VERSION);
    });
  });

  describe('setWritePending / consumeWritePending', () => {
    it('round-trips correctly', () => {
      setWritePending();
      expect(localStorage.getItem(LS_TOS_WRITE_PENDING)).toBe('true');
      expect(consumeWritePending()).toBe(true);
    });

    it('clears the flag after consuming', () => {
      setWritePending();
      consumeWritePending();
      expect(localStorage.getItem(LS_TOS_WRITE_PENDING)).toBeNull();
    });

    it('returns false when no flag is set', () => {
      expect(consumeWritePending()).toBe(false);
    });

    it('returns false on second consume', () => {
      setWritePending();
      consumeWritePending();
      expect(consumeWritePending()).toBe(false);
    });
  });

  describe('clearLocalConsent', () => {
    it('removes all consent keys', () => {
      localStorage.setItem(LS_TOS_ACCEPTED_VERSION, TOS_VERSION);
      localStorage.setItem(LS_TOS_WRITE_PENDING, 'true');
      clearLocalConsent();
      expect(localStorage.getItem(LS_TOS_ACCEPTED_VERSION)).toBeNull();
      expect(localStorage.getItem(LS_TOS_WRITE_PENDING)).toBeNull();
    });

    it('does not throw when keys are absent', () => {
      expect(() => clearLocalConsent()).not.toThrow();
    });
  });
});
