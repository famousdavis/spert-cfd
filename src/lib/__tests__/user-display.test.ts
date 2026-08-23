// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { getFirstName, normalizeDisplayName } from '../user-display';

describe('getFirstName', () => {
  it('extracts first token from "First Last"', () => {
    expect(getFirstName('Jane Doe', null)).toBe('Jane');
  });

  it('extracts first token after comma from "Last, First"', () => {
    expect(getFirstName('Doe, Jane', null)).toBe('Jane');
  });

  it('handles "Last, First Middle"', () => {
    expect(getFirstName('Doe, Jane Middle', null)).toBe('Jane');
  });

  it('trims whitespace around the comma-separated value', () => {
    expect(getFirstName('Doe,  Jane  ', null)).toBe('Jane');
  });

  it('handles single-token displayName', () => {
    expect(getFirstName('Jane', null)).toBe('Jane');
  });

  it('trims leading/trailing whitespace on plain displayName', () => {
    expect(getFirstName('   Jane  ', null)).toBe('Jane');
  });

  it('falls back to email when displayName is null', () => {
    expect(getFirstName(null, 'jane@example.com')).toBe('jane@example.com');
  });

  it('falls back to email when displayName is undefined', () => {
    expect(getFirstName(undefined, 'jane@example.com')).toBe('jane@example.com');
  });

  it('falls back to email when displayName is empty string', () => {
    expect(getFirstName('', 'jane@example.com')).toBe('jane@example.com');
  });

  it('returns empty string when both displayName and email are null', () => {
    expect(getFirstName(null, null)).toBe('');
  });

  it('returns empty string when both are empty', () => {
    expect(getFirstName('', '')).toBe('');
  });

  it('falls back to email when comma-format yields empty', () => {
    expect(getFirstName(', ', 'j@x.com')).toBe('j@x.com');
  });

  it('returns empty string when the comma format yields nothing and there is no email', () => {
    // Exercises the third fallback of `firstToken || email || ''` inside the
    // comma branch — the earlier email test stops at the second.
    expect(getFirstName(', ', null)).toBe('');
  });
});

// ── normalizeDisplayName ─────────────────────────────────
// Entirely untested until now, and LIVE: cloud-storage-modal.tsx:127 renders
// its result as the identity card's full name. It implements the Microsoft
// Entra ID "Last, First MI" -> "First MI Last" swap, and v0.15.1 shipped
// three days before these tests were written, about Microsoft sign-in.

describe('normalizeDisplayName', () => {
  it('returns an empty string for null', () => {
    expect(normalizeDisplayName(null)).toBe('');
  });

  it('returns an empty string for undefined', () => {
    expect(normalizeDisplayName(undefined)).toBe('');
  });

  it('returns an empty string for whitespace only', () => {
    expect(normalizeDisplayName('   ')).toBe('');
  });

  it('passes a name without a comma straight through', () => {
    // Google and most providers already return "First Last".
    expect(normalizeDisplayName('Ada Lovelace')).toBe('Ada Lovelace');
  });

  it('trims a passthrough name', () => {
    expect(normalizeDisplayName('  Ada Lovelace  ')).toBe('Ada Lovelace');
  });

  it('swaps the Entra "Last, First" form', () => {
    expect(normalizeDisplayName('Davis, William')).toBe('William Davis');
  });

  it('swaps "Last, First MI" and keeps the middle initial with the forename', () => {
    expect(normalizeDisplayName('Davis, William W')).toBe('William W Davis');
  });

  it('trims either side of the comma', () => {
    expect(normalizeDisplayName('  Davis ,  William W  ')).toBe('William W Davis');
  });

  it('returns the surname alone when nothing follows the comma', () => {
    expect(normalizeDisplayName('Davis,')).toBe('Davis');
  });

  it('returns the forename alone when nothing precedes the comma', () => {
    expect(normalizeDisplayName(', William')).toBe('William');
  });

  it('returns an empty string for a bare comma', () => {
    expect(normalizeDisplayName(',')).toBe('');
  });
});
