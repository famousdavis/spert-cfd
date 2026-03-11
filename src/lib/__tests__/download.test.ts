// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeFilename, downloadFile } from '../download';

describe('sanitizeFilename', () => {
  it('passes through clean names unchanged', () => {
    expect(sanitizeFilename('my-project_v2')).toBe('my-project_v2');
  });

  it('replaces spaces with underscores', () => {
    expect(sanitizeFilename('My Project')).toBe('My_Project');
  });

  it('replaces special characters with underscores', () => {
    expect(sanitizeFilename('Sprint @#$ Report!')).toBe('Sprint_Report_');
  });

  it('collapses consecutive underscores', () => {
    expect(sanitizeFilename('a   b   c')).toBe('a_b_c');
  });

  it('handles empty string', () => {
    expect(sanitizeFilename('')).toBe('');
  });

  it('preserves hyphens and underscores', () => {
    expect(sanitizeFilename('my_project-v2')).toBe('my_project-v2');
  });

  it('handles unicode characters', () => {
    expect(sanitizeFilename('项目报告')).toBe('_');
  });
});

describe('downloadFile', () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let createdAnchor: { href: string; download: string; click: () => void };

  beforeEach(() => {
    clickSpy = vi.fn();
    createdAnchor = { href: '', download: '', click: clickSpy };

    vi.spyOn(document, 'createElement').mockReturnValue(createdAnchor as unknown as HTMLElement);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('creates a download link with correct properties', () => {
    downloadFile('test content', 'report.csv', 'text/csv');

    expect(createdAnchor.href).toBe('blob:mock-url');
    expect(createdAnchor.download).toBe('report.csv');
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });
});
