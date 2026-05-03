// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { denormalizeLastFirst } from '../auth-name';

describe('denormalizeLastFirst', () => {
  it('reorders Microsoft AD "Last, First Middle" to "First Middle Last"', () => {
    expect(denormalizeLastFirst('Davis, William W')).toBe('William W Davis');
  });

  it('handles two-token "Last, First" form', () => {
    expect(denormalizeLastFirst('Davis, William')).toBe('William Davis');
  });

  it('handles a suffix segment as a third comma-separated part', () => {
    // "Smith, John, Jr." — split into [Smith, John, Jr.], reorder
    // as "John Jr. Smith" per the helper's documented behavior.
    expect(denormalizeLastFirst('Smith, John, Jr.')).toBe('John Jr. Smith');
  });

  it('returns single-token names unchanged', () => {
    expect(denormalizeLastFirst('Cher')).toBe('Cher');
  });

  it('returns the empty string for empty input', () => {
    expect(denormalizeLastFirst('')).toBe('');
  });

  it('trims surrounding whitespace from each segment', () => {
    expect(denormalizeLastFirst('  Davis  ,  William W  ')).toBe('William W Davis');
  });

  it('drops empty segments produced by stray commas', () => {
    expect(denormalizeLastFirst('Davis,,William')).toBe('William Davis');
  });

  it('returns the trimmed input as-is when only one non-empty segment exists', () => {
    // Filtering empty segments leaves length < 2, which short-circuits
    // to s.trim() (no reordering performed). Documents the helper's
    // pass-through behavior for malformed inputs — matches the
    // mailHeaders.ts mirror.
    expect(denormalizeLastFirst(',William')).toBe(',William');
    expect(denormalizeLastFirst('William,')).toBe('William,');
  });

  it('leaves Western "First Last" without a comma untouched', () => {
    expect(denormalizeLastFirst('Alice Owner')).toBe('Alice Owner');
  });
});
