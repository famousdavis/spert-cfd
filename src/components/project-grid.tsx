// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { DndContext, closestCenter, type DragEndEvent, type useSensors } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import type { ProjectListItem, StorageMode } from '@/lib/storage-driver';
import type { ProjectStats } from '@/lib/project-tile-meta';
import { tileAccess } from '@/lib/tile-access';
import { AllArchivedLine } from './archive-controls';
import type { useProjectArchive } from './use-project-archive';
import { SortableProjectTile } from './project-row';

// v0.24.0 (FRAME26 pass 3, C1): moved from projects-tab.tsx unchanged, where it
// was already its own function.

/** The grid of shown tiles (v0.21.0: archived ones only with "Show archived"); dnd-kit sorts these and no others. */
export function ProjectGrid({
  sensors,
  onDragEnd,
  shown,
  stats,
  mode,
  view,
  onExport,
  onEdit,
  onShare,
  onClone,
  onDelete,
}: {
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
  shown: ProjectListItem[];
  stats: Map<string, ProjectStats>;
  mode: StorageMode;
  view: ReturnType<typeof useProjectArchive>;
  onExport: (id: string) => void;
  onEdit: (id: string) => void;
  onShare: (id: string) => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  // Every project archived and the filter off: this line, never the welcome panel (O50).
  if (shown.length === 0) return <AllArchivedLine count={view.archivedCount} />;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={shown.map((p) => p.id)} strategy={rectSortingStrategy}>
        {/* The frame's tile grid (contract §3): 340 px minimum columns, 16 px
            gaps, 16 px below the row above (3 columns at 1280 and 1440, 4 at
            1920). Until v0.22.0 it was a container-query grid of 1 to 3. */}
        <ul className="sf-tiles" data-sf="tiles" aria-label="Projects">
          {shown.map((p) => {
            const pref = view.prefOf(p.id);
            return (
              <SortableProjectTile
                key={p.id}
                id={p.id}
                name={p.name}
                stats={stats.get(p.id)}
                access={tileAccess(mode, p.role, p.memberCount)}
                onOpen={view.openProject}
                onExport={onExport}
                onEdit={onEdit}
                onShare={onShare}
                onClone={onClone}
                onDelete={onDelete}
                color={pref.color}
                archived={pref.archived === true}
                prefsBlockedReason={view.blockedReason(p.id)}
                dragBlockedReason={view.dragBlockedReason}
                colorOpen={view.colorOpenFor === p.id}
                onColorOpenChange={view.setColorOpen}
                onPickColor={view.pickColor}
                onArchive={view.archive}
                onUnarchive={view.unarchive}
              />
            );
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
