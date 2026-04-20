// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { getFirstName } from '../user-display';

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
});
