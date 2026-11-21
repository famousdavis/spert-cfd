// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.
// @vitest-environment jsdom

// v0.18.0 (DASH26 R1a, Char-DASH-1 §B #1): reordering is by pointer drag, and a
// drag starts from the grip only. dnd-kit's pointer listeners are on the grip,
// its node on the <li>; the rest of the tile (the name opens the CFD tab, the
// icons act) never starts one. The drop itself, which needs real layout, is
// measured in a browser (evidence P3 #1).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { SortableProjectTile } from '../project-row';
import { tileAccess } from '@/lib/tile-access';

function Harness({ onDragStart }: { onDragStart: (e: { active: { id: string | number } }) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  return (
    <DndContext sensors={sensors} onDragStart={onDragStart}>
      <SortableContext items={['p1']}>
        <ul>
          <SortableProjectTile
            id="p1" name="Alpha" stats={undefined} access={tileAccess('local', undefined, undefined)}
            onOpen={vi.fn()} onExport={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onShare={vi.fn()}
          />
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function drag(el: Element) {
  fireEvent.pointerDown(el, { button: 0, isPrimary: true, clientX: 10, clientY: 10, pointerId: 1 });
  fireEvent.pointerMove(document, { clientX: 40, clientY: 10, pointerId: 1 });
  fireEvent.pointerUp(document, { clientX: 40, clientY: 10, pointerId: 1 });
}

describe('dragging a tile', () => {
  it('starts from the grip, past the 8 px activation distance', () => {
    const onDragStart = vi.fn();
    render(<Harness onDragStart={onDragStart} />);
    drag(document.querySelector('[title="Drag to reorder"]')!);
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDragStart.mock.calls[0][0].active.id).toBe('p1');
  });

  it('never starts from the name or the tile itself', () => {
    const onDragStart = vi.fn();
    render(<Harness onDragStart={onDragStart} />);
    drag(screen.getByRole('button', { name: 'Open CFD for Alpha' }));
    drag(document.querySelector('li[data-tile="true"]')!);
    expect(onDragStart).not.toHaveBeenCalled();
  });
});
