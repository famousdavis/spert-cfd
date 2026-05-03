// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { parseBulkEmails } from '../parse-bulk-emails';

describe('parseBulkEmails', () => {
  it('returns empty array for empty input', () => {
    expect(parseBulkEmails('')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(parseBulkEmails('   \n\t  ')).toEqual([]);
  });

  it('parses a single email', () => {
    expect(parseBulkEmails('alice@example.com')).toEqual(['alice@example.com']);
  });

  it('splits on commas', () => {
    expect(parseBulkEmails('a@x.com,b@x.com,c@x.com')).toEqual([
      'a@x.com', 'b@x.com', 'c@x.com',
    ]);
  });

  it('splits on semicolons', () => {
    expect(parseBulkEmails('a@x.com;b@x.com;c@x.com')).toEqual([
      'a@x.com', 'b@x.com', 'c@x.com',
    ]);
  });

  it('splits on newlines', () => {
    expect(parseBulkEmails('a@x.com\nb@x.com\nc@x.com')).toEqual([
      'a@x.com', 'b@x.com', 'c@x.com',
    ]);
  });

  it('splits on whitespace (spaces and tabs)', () => {
    expect(parseBulkEmails('a@x.com b@x.com\tc@x.com')).toEqual([
      'a@x.com', 'b@x.com', 'c@x.com',
    ]);
  });

  it('handles mixed separators', () => {
    expect(parseBulkEmails('a@x.com, b@x.com;\nc@x.com\td@x.com')).toEqual([
      'a@x.com', 'b@x.com', 'c@x.com', 'd@x.com',
    ]);
  });

  it('lowercases addresses', () => {
    expect(parseBulkEmails('Alice@Example.COM')).toEqual(['alice@example.com']);
  });

  it('trims whitespace around addresses', () => {
    expect(parseBulkEmails('   alice@example.com   ')).toEqual(['alice@example.com']);
  });

  it('deduplicates while preserving original order', () => {
    expect(parseBulkEmails('a@x.com, b@x.com, A@X.COM, c@x.com, b@x.com')).toEqual([
      'a@x.com', 'b@x.com', 'c@x.com',
    ]);
  });

  it('drops empty entries from runs of separators', () => {
    expect(parseBulkEmails(',,,a@x.com ,,, b@x.com,,,')).toEqual([
      'a@x.com', 'b@x.com',
    ]);
  });

  it('does NOT validate email format (validation is server-side)', () => {
    // EMAIL_RE happens in the Cloud Function; the parser is a
    // pure normalizer that hands raw tokens to the callable.
    expect(parseBulkEmails('not-an-email, also-bad')).toEqual([
      'not-an-email', 'also-bad',
    ]);
  });
});
