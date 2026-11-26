// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.23.0 (FRAME26 clean-up C8): the page does not scroll while any dialog is
// open. The lock is counted: a dialog over another releases only its own hold.
// Each overlay dialog takes it: five rendered here, and a census of every
// fixed-overlay component in src/components so a new one cannot miss it.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { useScrollLock, scrollLockHolds } from '../use-scroll-lock';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ConsentModal } from '@/components/consent-modal';
import { SwitchToLocalDialog } from '@/components/switch-to-local-dialog';
import { ProjectDialog } from '@/components/project-dialog';
import { CsvImportModal } from '@/components/grid/csv-import-modal';

beforeEach(() => { document.body.style.overflow = ''; });

describe('useScrollLock', () => {
  it('locks the page while held and restores what was there when released', () => {
    document.body.style.overflow = 'clip';
    const { unmount } = renderHook(() => useScrollLock());
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('clip');
    expect(scrollLockHolds()).toBe(0);
  });

  it('a stacked pair: closing the inner one keeps the page locked; the last one unlocks it', () => {
    const outer = renderHook(() => useScrollLock());
    const inner = renderHook(() => useScrollLock());
    expect(scrollLockHolds()).toBe(2);
    inner.unmount();
    expect(document.body.style.overflow).toBe('hidden');
    outer.unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('follows `active`: off holds nothing, on holds, off again releases', () => {
    const { rerender, unmount } = renderHook(({ on }) => useScrollLock(on), { initialProps: { on: false } });
    expect(document.body.style.overflow).toBe('');
    rerender({ on: true });
    expect(document.body.style.overflow).toBe('hidden');
    rerender({ on: false });
    expect(document.body.style.overflow).toBe('');
    unmount();
    expect(scrollLockHolds()).toBe(0);
  });
});

describe('the dialogs take it while open', () => {
  const cases: Array<[string, () => React.ReactElement]> = [
    ['ConfirmDialog', () => <ConfirmDialog title="Delete Project" message="Delete?" confirmLabel="Delete" onConfirm={vi.fn()} onCancel={vi.fn()} />],
    ['ConsentModal', () => <ConsentModal onAccept={vi.fn()} onCancel={vi.fn()} />],
    ['SwitchToLocalDialog', () => <SwitchToLocalDialog projectCount={1} onKeepLocalCopy={vi.fn(async () => {})} onDiscard={vi.fn()} onCancel={vi.fn()} />],
    ['ProjectDialog', () => <ProjectDialog identity="new" title="New Project" initialName="" submitLabel="Create" onSubmit={vi.fn()} onCancel={vi.fn()} returnFocusTo={() => null} />],
    ['CsvImportModal', () => <CsvImportModal workflow={[]} snapshots={[]} onImport={vi.fn()} onClose={vi.fn()} />],
  ];
  for (const [name, el] of cases) {
    it(`${name}: locked while open, unlocked once closed`, () => {
      const { unmount } = render(el());
      expect(document.body.style.overflow).toBe('hidden');
      unmount();
      expect(document.body.style.overflow).toBe('');
    });
  }
});

describe('census: every fixed-overlay component in src/components calls useScrollLock', () => {
  const root = join(process.cwd(), 'src', 'components');
  const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === '__tests__' ? [] : files(p);
    return /\.tsx?$/.test(n) ? [p] : [];
  });
  // A dialog's overlay is a full-window fixed layer; the tile colour popover has none and takes no lock.
  const overlays = files(root).filter((p) => /fixed inset-0/.test(readFileSync(p, 'utf8')));
  const toCheck = overlays.flatMap((p) => {
    const src = readFileSync(p, 'utf8');
    // dashboard-styles.ts holds the project dialog's OVERLAY string; its user is project-dialog.tsx.
    return /export const OVERLAY/.test(src) ? [join(root, 'project-dialog.tsx')] : [p];
  });

  it('finds the seven overlay dialogs (a must-find control: the census cannot pass by finding none)', () => {
    expect(new Set(toCheck.map((p) => relative(root, p))).size).toBe(7);
  });

  for (const p of [...new Set(toCheck)]) {
    it(`${relative(root, p)}`, () => {
      expect(readFileSync(p, 'utf8')).toMatch(/\buseScrollLock\(/);
    });
  }
});
