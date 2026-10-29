// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// CloudLoadNoticeBanner and its store (v0.16.4) — the notice names the
// project in which a cloud-load check set something aside, never the value;
// "Got it" closes it for the session; a sign-out (runDataReset) forgets it.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const list = vi.hoisted(() => ({ projects: [] as { id: string; name: string }[] }));
vi.mock('@/contexts/project-list-context', () => ({ useProjectList: () => list }));

import { CloudLoadNoticeBanner } from '../cloud-load-notice-banner';
import { noteCloudSetAside, clearCloudSetAsideNotices, getCloudSetAsideProjects } from '@/lib/cloud-load-notices';
import { runDataReset } from '@/lib/app-data-reset-registry';

describe('CloudLoadNoticeBanner', () => {
  beforeEach(() => {
    clearCloudSetAsideNotices();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    list.projects = [{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: '' }];
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows nothing when nothing was set aside', () => {
    const { container } = render(<CloudLoadNoticeBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('names the project, and only the project', () => {
    render(<CloudLoadNoticeBanner />);
    act(() => noteCloudSetAside('p1', 'snapshot'));
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('Some saved data could not be read in project “Alpha”.');
    expect(notice.textContent).not.toContain('snapshot');
  });

  it('names a project whose name itself could not be read by the placeholder', () => {
    render(<CloudLoadNoticeBanner />);
    act(() => noteCloudSetAside('p2', 'project-name'));
    expect(screen.getByRole('status').textContent).toContain('in project “Untitled project”.');
  });

  it('logs the rule only', () => {
    noteCloudSetAside('p1', 'workflow-state');
    expect(console.warn).toHaveBeenCalledExactlyOnceWith('[SPERT CFD] cloud-load-guard: workflow-state');
  });

  it('closes on "Got it", and does not name that project again this session', () => {
    render(<CloudLoadNoticeBanner />);
    act(() => noteCloudSetAside('p1', 'snapshot'));
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('status')).toBeNull();
    act(() => noteCloudSetAside('p1', 'snapshot'));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('is forgotten at sign-out, through the data reset registry', () => {
    noteCloudSetAside('p1', 'snapshot');
    expect(getCloudSetAsideProjects()).toEqual(['p1']);
    runDataReset();
    expect(getCloudSetAsideProjects()).toEqual([]);
  });
});
