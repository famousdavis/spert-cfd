// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.21.0 (DASH26 R35): the CFD tab's picker keeps archived projects, marked;
// choosing one opens it and leaves it archived.
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const h = vi.hoisted(() => {
  const ready = { status: 'ready' as const, prefs: { b: { archived: true as const } } };
  return {
    list: {
      projects: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Bravo' }],
      activeProjectId: 'a',
      switchProject: vi.fn(),
    },
    storage: {
      driver: {
        mode: 'local',
        getProjectPrefs: () => ready,
        onProjectPrefsChange: () => () => {},
        setProjectPref: vi.fn(() => null),
        retryProjectPrefs: () => {},
      },
    },
  };
});
vi.mock('@/contexts/project-list-context', () => ({ useProjectList: () => h.list }));
vi.mock('@/contexts/storage-context', () => ({ useStorage: () => h.storage }));

import { ProjectPicker } from '../project-picker';

it('lists the archived project marked "(archived)"; choosing it opens it and writes nothing', () => {
  render(<ProjectPicker />);
  const select = screen.getByRole('combobox') as HTMLSelectElement;
  expect([...select.options].map((o) => o.textContent)).toEqual(['Alpha', 'Bravo (archived)']);
  fireEvent.change(select, { target: { value: 'b' } });
  expect(h.list.switchProject).toHaveBeenCalledWith('b');
  expect(h.storage.driver.setProjectPref).not.toHaveBeenCalled();
});
