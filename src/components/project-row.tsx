// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useId, type CSSProperties, type Ref } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UNNAMED_PROJECT } from '@/lib/cloud-load-guards';
import { tileMetaLines, type ProjectStats } from '@/lib/project-tile-meta';
import type { TileAccess } from '@/lib/tile-access';
import { DragHandle } from './icons/drag-handle';
import { CloneIconButton, ExportIconButton, PencilIconButton, ShareIconButton, TrashIconButton } from './icons/icon-buttons';
import {
  ABOVE_OPEN,
  ACTIONS,
  BADGE,
  GRIP,
  META,
  NAME,
  NAME_COLOR,
  NAME_ROW,
  OPEN,
  REVEAL,
  TILE,
  TILE_BG,
  TILE_BORDER,
  TILE_HOVER,
} from './dashboard-styles';

export interface ProjectTileProps {
  id: string;
  name: string;
  stats: ProjectStats | undefined;
  access: TileAccess;
  onOpen: (id: string) => void;
  onExport: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
  /** v0.19.0 (DASH26 R1b): Clone, offered on every tile, to every role (O9). */
  onClone: (id: string) => void;
  /** dnd-kit's pointer listeners, spread on the grip only. */
  gripProps?: Record<string, unknown>;
  nodeRef?: Ref<HTMLLIElement>;
  style?: CSSProperties;
  isDragging?: boolean;
}

/**
 * One project's tile (v0.18.0, DASH26 R1a): SPERT® Forecaster's `ProjectTile`
 * anatomy at df59b2d. The grip, the name, its access badge and Delete in the
 * first row; the meta lines (R7); then the revealed row, Share (cloud owner) ·
 * Export · Edit · Clone (Clone since v0.19.0, R1b), shown on hover, on focus inside the tile, and always where
 * there is no hover. No open-project marker (R8: the CFD tab names the open
 * project).
 *
 * ⚠️ The whole tile opens the CFD tab through the name button's `::after`,
 * which covers the tile. There is deliberately NO click handler on the tile
 * root: every icon's click would bubble into it and navigate, Delete's
 * included.
 *
 * Reordering is by pointer drag on the grip (dnd-kit, kept). dnd-kit's
 * `attributes` are NOT spread on the tile: until v0.18.0 they made a
 * `role=button`, `tabindex=0` "sortable" wrapper whose keyboard instructions
 * did nothing (keyboard reorder never worked, measured by DASH26 Char-DASH-1).
 */
export function ProjectTile({
  id,
  name,
  stats,
  access,
  onOpen,
  onExport,
  onEdit,
  onDelete,
  onShare,
  onClone,
  gripProps,
  nodeRef,
  style,
  isDragging,
}: ProjectTileProps) {
  const reasonId = useId();
  const deleteReasonId = `${reasonId}-delete`;
  const editReasonId = `${reasonId}-edit`;
  const display = name || UNNAMED_PROJECT;
  const { badge, showShare, deleteBlockedReason, editBlockedReason } = access;
  return (
    <li
      ref={nodeRef}
      style={style}
      data-tile="true"
      data-project-id={id}
      className={`${TILE} ${TILE_BG} ${TILE_BORDER} ${TILE_HOVER}${isDragging ? ' z-10 opacity-50' : ''}`}
    >
      <div className={NAME_ROW}>
        {/* The only place a drag starts. */}
        <span title="Drag to reorder" aria-hidden="true" className={GRIP} {...gripProps}>
          <DragHandle />
        </span>
        <h3 className={`${NAME} ${NAME_COLOR}`}>
          <button
            type="button"
            className={OPEN}
            onClick={() => onOpen(id)}
            title="Open CFD"
            aria-label={`Open CFD for ${display}${badge ? ` (${badge})` : ''}`}
          >
            {display}
          </button>
        </h3>
        {badge && <span className={BADGE}>{badge}</span>}
        <span className={`${ABOVE_OPEN} inline-flex flex-none`}>
          {deleteBlockedReason && (
            <span id={deleteReasonId} className="sr-only">
              {deleteBlockedReason}
            </span>
          )}
          <TrashIconButton
            onClick={() => onDelete(id)}
            ariaLabel={`Delete ${display}`}
            title={deleteBlockedReason ?? 'Delete project'}
            disabled={deleteBlockedReason !== null}
            describedBy={deleteBlockedReason ? deleteReasonId : undefined}
          />
        </span>
      </div>
      {tileMetaLines(stats).map((line, i) => (
        <p key={i} className={META}>
          {line}
        </p>
      ))}
      <div className={ACTIONS}>
        <div className={`${REVEAL} ${ABOVE_OPEN}`}>
          {showShare && <ShareIconButton onClick={() => onShare(id)} ariaLabel={`Share ${display}`} title="Share project" />}
          <ExportIconButton onClick={() => onExport(id)} ariaLabel={`Export ${display}`} title="Export project" />
          {editBlockedReason && (
            <span id={editReasonId} className="sr-only">
              {editBlockedReason}
            </span>
          )}
          <PencilIconButton
            onClick={() => onEdit(id)}
            ariaLabel={`Edit ${display}`}
            title={editBlockedReason ?? 'Edit project'}
            disabled={editBlockedReason !== null}
            describedBy={editBlockedReason ? editReasonId : undefined}
          />
          <CloneIconButton onClick={() => onClone(id)} ariaLabel={`Clone ${display}`} title="Clone project" />
        </div>
      </div>
    </li>
  );
}

type SortableProjectTileProps = Omit<ProjectTileProps, 'gripProps' | 'nodeRef' | 'style' | 'isDragging'>;

/** The tile in the Projects grid: dnd-kit's node on the `<li>`, its pointer listeners on the grip. */
export function SortableProjectTile(props: SortableProjectTileProps) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id });
  return (
    <ProjectTile
      {...props}
      nodeRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      gripProps={listeners}
      isDragging={isDragging}
    />
  );
}
