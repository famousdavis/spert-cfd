// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.18.0 (DASH26 R1a; PR #108 review, -03): one Escape closes one surface.
// Every window that can open while the Projects tab's import preview waits
// closes on Escape through `useModalEscape`: the innermost window only, and
// never the preview, whose own Escape listens on `document` in the bubble phase
// (it is stood in for here by a component using the real `useEscapeKey`). The
// Cloud Storage window is measured live too (evidence G1); the sharing window,
// the consent window and the switch-to-local dialog need a cloud account or a
// sign-in, so they are checked here.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { useEscapeKey, useModalEscape } from '@/lib/use-dismiss';

const h = vi.hoisted(() => ({
  user: null as null | { uid: string; displayName: string; email: string },
  mode: 'local' as 'local' | 'cloud',
  project: null as unknown,
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: h.user, signOut: vi.fn(), signInWithGoogle: vi.fn(), signInWithMicrosoft: vi.fn(), signInError: null, clearSignInError: vi.fn() }),
}));
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({
    mode: h.mode,
    switchMode: vi.fn(),
    isCloudAvailable: true,
    driver: { mode: h.mode, loadProject: async () => h.project, onProjectChange: () => () => {}, getPendingInvites: async () => [] },
  }),
}));
vi.mock('@/contexts/project-list-context', () => ({ useProjectList: () => ({ projects: [] }) }));
vi.mock('../cloud-migration-flow', () => ({
  CloudMigrationFlow: forwardRef(function CloudMigrationFlow(_props, ref) {
    useImperativeHandle(ref, () => ({ requestCloudSwitch: () => {} }));
    return null;
  }),
}));
vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), setDoc: vi.fn() }));
vi.mock('@/lib/callables', () => ({ callSendInvitationEmail: vi.fn(), callRevokeInvite: vi.fn(), callResendInvite: vi.fn() }));
vi.mock('@/lib/use-member-profiles', () => ({ useMemberProfiles: () => ({}) }));
vi.mock('@/components/pending-invites-list', () => ({ PendingInvitesList: () => null }));

import { CloudStorageModal } from '../cloud-storage-modal';
import { SharingModal } from '../sharing-modal';
import { ConsentModal } from '../consent-modal';
import { SwitchToLocalDialog } from '../switch-to-local-dialog';

/** The waiting import preview's Escape, by its real mechanism. */
function Preview({ onCancel }: { onCancel: () => void }) {
  useEscapeKey(onCancel);
  return <section aria-label="Import preview">Preview</section>;
}

const escape = () => act(async () => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' }); });

let previewCancel: ReturnType<typeof vi.fn<() => void>>;
beforeEach(() => {
  previewCancel = vi.fn<() => void>();
  h.user = null;
  h.mode = 'local';
  h.project = null;
});
afterEach(() => vi.restoreAllMocks());

/** Render the preview first (it is already waiting), then the window over it. */
function overPreview(win: ReactNode) {
  const view = render(<Preview onCancel={previewCancel} />);
  view.rerender(<><Preview onCancel={previewCancel} />{win}</>);
  return view;
}

describe('useModalEscape: the innermost window only', () => {
  function Win({ name, onClose, active = true, children }: { name: string; onClose: () => void; active?: boolean; children?: ReactNode }) {
    useModalEscape(onClose, active);
    return <div role="dialog" aria-label={name}>{children}</div>;
  }

  it('closes the window opened last, then the one under it; the preview never hears either Escape', async () => {
    const outer = vi.fn(), inner = vi.fn();
    const view = overPreview(<Win name="outer" onClose={outer} />);
    view.rerender(<><Preview onCancel={previewCancel} /><Win name="outer" onClose={outer}><Win name="inner" onClose={inner} /></Win></>);
    await escape();
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    view.rerender(<><Preview onCancel={previewCancel} /><Win name="outer" onClose={outer} /></>);
    await escape();
    expect(outer).toHaveBeenCalledTimes(1);
    expect(previewCancel).not.toHaveBeenCalled();
  });

  it('a window that is mounted but not active (closed) swallows nothing: the preview hears Escape', async () => {
    const closed = vi.fn();
    overPreview(<Win name="closed" onClose={closed} active={false} />);
    await escape();
    expect(closed).not.toHaveBeenCalled();
    expect(previewCancel).toHaveBeenCalledTimes(1);
  });

  it('control: with no window, the preview hears Escape', async () => {
    render(<Preview onCancel={previewCancel} />);
    await escape();
    expect(previewCancel).toHaveBeenCalledTimes(1);
  });
});

describe('each window over a waiting import preview', () => {
  it('the Cloud Storage window: Escape closes it and leaves the preview; closed, it leaves Escape to the preview', async () => {
    const onClose = vi.fn();
    const view = overPreview(<CloudStorageModal open onClose={onClose} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    await escape();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(previewCancel).not.toHaveBeenCalled();
    view.rerender(<><Preview onCancel={previewCancel} /><CloudStorageModal open={false} onClose={onClose} /></>);
    await escape();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(previewCancel).toHaveBeenCalledTimes(1);
  });

  it('the switch-to-local dialog over the Cloud Storage window: Escape closes the dialog only', async () => {
    h.user = { uid: 'u1', displayName: 'Test User', email: 'test@example.com' };
    h.mode = 'cloud';
    const onClose = vi.fn();
    overPreview(<CloudStorageModal open onClose={onClose} />);
    fireEvent.click(screen.getByRole('radio', { name: /Local \(browser only\)/ }));
    expect(screen.getByRole('button', { name: 'Discard' })).toBeTruthy();
    await escape();
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(previewCancel).not.toHaveBeenCalled();
    await escape();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(previewCancel).not.toHaveBeenCalled();
  });

  it('the switch-to-local dialog alone: Escape cancels it and leaves the preview', async () => {
    const onCancel = vi.fn();
    overPreview(<SwitchToLocalDialog projectCount={2} onKeepLocalCopy={async () => {}} onDiscard={vi.fn()} onCancel={onCancel} />);
    await escape();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(previewCancel).not.toHaveBeenCalled();
  });

  it('the consent window: Escape cancels it and leaves the preview', async () => {
    const onCancel = vi.fn();
    overPreview(<ConsentModal onAccept={vi.fn()} onCancel={onCancel} />);
    await escape();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(previewCancel).not.toHaveBeenCalled();
  });

  it('the sharing window: Escape closes it and leaves the preview; its confirmation, opened over it, closes first', async () => {
    h.user = { uid: 'u1', displayName: 'Owner', email: 'o@example.com' };
    h.mode = 'cloud';
    h.project = {
      id: 'p1', name: 'Shared project', createdAt: '', workflow: [], snapshots: [],
      settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
      owner: 'u1', members: { u1: 'owner', u2: 'editor' },
    };
    const onClose = vi.fn();
    overPreview(<SharingModal projectId="p1" onClose={onClose} />);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    await escape();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    await escape();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(previewCancel).not.toHaveBeenCalled();
  });
});
