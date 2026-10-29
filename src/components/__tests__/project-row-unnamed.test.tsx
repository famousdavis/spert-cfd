// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.16.4: a project whose name was read from the cloud as '' (it was not
// text) keeps a visible, reachable card. The placeholder is display-only; the
// app never writes an empty name, since create and rename both refuse one.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectCard } from '../project-row';

function renderCard(name: string) {
  return render(
    <ProjectCard
      id="p1"
      name={name}
      stats={undefined}
      isActive={false}
      onOpen={vi.fn()}
      onExport={vi.fn()}
      onDelete={vi.fn()}
      onRename={vi.fn()}
    />,
  );
}

describe('project card name', () => {
  it('shows a placeholder for an empty name, and the card can still be opened and deleted', () => {
    renderCard('');
    expect(screen.getByText('Untitled project')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Untitled project' })).toBeTruthy();
  });

  it('shows a real name as written', () => {
    renderCard('Alpha');
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.queryByText('Untitled project')).toBeNull();
  });
});
