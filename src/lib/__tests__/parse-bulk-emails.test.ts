// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { parseBulkEmails } from '../parse-bulk-emails';

describe('parseBulkEmails', () => {
  it('returns empty arrays for empty input', () => {
    expect(parseBulkEmails('')).toEqual({ valid: [], invalid: [] });
  });

  it('returns empty arrays for whitespace-only input', () => {
    expect(parseBulkEmails('   \n\t  ')).toEqual({ valid: [], invalid: [] });
  });

  it('parses a single valid email', () => {
    expect(parseBulkEmails('alice@example.com')).toEqual({
      valid: ['alice@example.com'],
      invalid: [],
    });
  });

  it('splits on commas', () => {
    expect(parseBulkEmails('a@x.com,b@x.com,c@x.com').valid).toEqual([
      'a@x.com', 'b@x.com', 'c@x.com',
    ]);
  });

  it('splits on semicolons', () => {
    expect(parseBulkEmails('a@x.com;b@x.com;c@x.com').valid).toEqual([
      'a@x.com', 'b@x.com', 'c@x.com',
    ]);
  });

  it('splits on newlines', () => {
    expect(parseBulkEmails('a@x.com\nb@x.com\nc@x.com').valid).toEqual([
      'a@x.com', 'b@x.com', 'c@x.com',
    ]);
  });

  it('splits on whitespace (spaces and tabs)', () => {
    expect(parseBulkEmails('a@x.com b@x.com\tc@x.com').valid).toEqual([
      'a@x.com', 'b@x.com', 'c@x.com',
    ]);
  });

  it('handles mixed separators', () => {
    expect(parseBulkEmails('a@x.com, b@x.com;\nc@x.com\td@x.com').valid).toEqual([
      'a@x.com', 'b@x.com', 'c@x.com', 'd@x.com',
    ]);
  });

  it('lowercases valid addresses', () => {
    expect(parseBulkEmails('Alice@Example.COM').valid).toEqual([
      'alice@example.com',
    ]);
  });

  it('trims whitespace around addresses', () => {
    expect(parseBulkEmails('   alice@example.com   ').valid).toEqual([
      'alice@example.com',
    ]);
  });

  it('deduplicates while preserving original order (case-insensitive)', () => {
    expect(
      parseBulkEmails('a@x.com, b@x.com, A@X.COM, c@x.com, b@x.com').valid,
    ).toEqual(['a@x.com', 'b@x.com', 'c@x.com']);
  });

  it('drops empty entries from runs of separators', () => {
    expect(parseBulkEmails(',,,a@x.com ,,, b@x.com,,,').valid).toEqual([
      'a@x.com', 'b@x.com',
    ]);
  });

  it('partitions invalid tokens into the invalid array (Lesson 42)', () => {
    expect(parseBulkEmails('not-an-email, also-bad')).toEqual({
      valid: [],
      invalid: ['not-an-email', 'also-bad'],
    });
  });

  it('returns mixed valid + invalid for mixed input', () => {
    const r = parseBulkEmails('alice@example.com, broken, bob@example.com');
    expect(r.valid).toEqual(['alice@example.com', 'bob@example.com']);
    expect(r.invalid).toEqual(['broken']);
  });

  it('treats missing TLD as invalid', () => {
    expect(parseBulkEmails('alice@example').invalid).toEqual(['alice@example']);
  });

  it('treats missing @ as invalid', () => {
    expect(parseBulkEmails('alice.example.com').invalid).toEqual([
      'alice.example.com',
    ]);
  });

  it('deduplicates across the valid/invalid boundary', () => {
    // Same token appears twice; should only count once on whichever side.
    const r = parseBulkEmails('not-an-email, NOT-AN-EMAIL');
    expect(r.invalid).toEqual(['not-an-email']);
    expect(r.valid).toEqual([]);
  });
});
