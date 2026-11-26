// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useId, useRef, type CSSProperties, type Ref } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UNNAMED_PROJECT } from '@/lib/cloud-load-guards';
import { tileMetaLines, type ProjectStats } from '@/lib/project-tile-meta';
import type { TileAccess } from '@/lib/tile-access';
import { DragHandle } from './icons/drag-handle';
import type { ProjectColor } from '@/lib/project-prefs';
import {
  ArchiveIconButton,
  CloneIconButton,
  ExportIconButton,
  PencilIconButton,
  ShareIconButton,
  TrashIconButton,
  UnarchiveIconButton,
} from './icons/icon-buttons';
import { ProjectColorButton, ProjectColorPopover } from './project-color-control';
import { TILE_TINT, TILE_TINT_ARCHIVED } from './tile-color-styles';
import {
  ABOVE_OPEN,
  ACTIONS,
  BADGE,
  GRIP,
  META,
  NAME,
  NAME_ARCHIVED,
  NAME_COLOR,
  NAME_ROW,
  OPEN,
  REVEAL,
  STAY,
  TILE,
  TILE_ARCHIVED_BORDER,
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
  /** v0.21.0 (DASH26 R2): this person's colour for the project, if any. */
  color?: ProjectColor;
  /** v0.21.0: archived by this person (O50: half the tint, dashed, the meta colour, "Archived"). */
  archived?: boolean;
  /** Why Tile color, Archive and Unarchive cannot be used now (O54, O60), or null. */
  prefsBlockedReason?: string | null;
  /** Why the tile cannot be dragged now (O54), or null. */
  dragBlockedReason?: string | null;
  colorOpen?: boolean;
  onColorOpenChange?: (id: string, open: boolean) => void;
  /** Applies a colour (null: No color); false when refused, and nothing changed. */
  onPickColor?: (id: string, color: ProjectColor | null) => boolean;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
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
  color,
  archived = false,
  prefsBlockedReason = null,
  dragBlockedReason = null,
  colorOpen = false,
  onColorOpenChange = () => {},
  onPickColor = () => false,
  onArchive = () => {},
  onUnarchive = () => {},
  gripProps,
  nodeRef,
  style,
  isDragging,
}: ProjectTileProps) {
  const reasonId = useId();
  const deleteReasonId = `${reasonId}-delete`;
  const editReasonId = `${reasonId}-edit`;
  const prefsReasonId = `${reasonId}-prefs`;
  const colorButtonRef = useRef<HTMLButtonElement>(null);
  const display = name || UNNAMED_PROJECT;
  const { badge, showShare, deleteBlockedReason, editBlockedReason } = access;
  const tint = (archived ? TILE_TINT_ARCHIVED : TILE_TINT)[color ?? 'none'];
  const openLabel = `${archived ? 'Unarchive and open CFD for ' : 'Open CFD for '}${display}${badge ? ` (${badge})` : ''}`;
  const prefsDescribedBy = prefsBlockedReason ? prefsReasonId : undefined;
  return (
    <li
      ref={nodeRef}
      style={style}
      data-tile="true"
      data-project-id={id}
      data-color={color ?? 'none'}
      data-archived={archived ? 'true' : undefined}
      data-popopen={colorOpen ? 'true' : undefined}
      className={`${TILE} ${tint} ${archived ? TILE_ARCHIVED_BORDER : TILE_BORDER} ${TILE_HOVER}${isDragging ? ' z-10 opacity-50' : ''}`}
    >
      <div className={NAME_ROW}>
        {/* The only place a drag starts. */}
        <span title={dragBlockedReason ?? 'Drag to reorder'} aria-hidden="true" className={GRIP} {...gripProps}>
          <DragHandle tinted={color !== undefined} />
        </span>
        <h3 className={`${NAME} ${archived ? NAME_ARCHIVED : NAME_COLOR}`}>
          <button
            type="button"
            className={OPEN}
            onClick={() => onOpen(id)}
            title={archived ? 'Unarchive and open CFD' : 'Open CFD'}
            aria-label={openLabel}
          >
            {display}
          </button>
        </h3>
        {badge && <span className={BADGE}>{badge}</span>}
        {archived && <span className={BADGE}>Archived</span>}
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
          {prefsBlockedReason && (
            <span id={prefsReasonId} className="sr-only">
              {prefsBlockedReason}
            </span>
          )}
          {!archived && (
            <ArchiveIconButton
              onClick={() => onArchive(id)}
              ariaLabel={`Archive ${display}`}
              title={prefsBlockedReason ?? 'Archive project'}
              disabled={prefsBlockedReason !== null}
              describedBy={prefsDescribedBy}
            />
          )}
          <ProjectColorButton
            projectName={display}
            color={color}
            open={colorOpen}
            buttonRef={colorButtonRef}
            onOpenChange={(open) => onColorOpenChange(id, open)}
            disabledReason={prefsBlockedReason}
            describedBy={prefsDescribedBy}
          />
        </div>
        {archived && (
          // Always shown, and above the name button's `::after` (a click there would open the tile).
          <div className={`${STAY} ${ABOVE_OPEN}`}>
            <UnarchiveIconButton
              onClick={() => onUnarchive(id)}
              ariaLabel={`Unarchive ${display}`}
              title={prefsBlockedReason ?? 'Unarchive project'}
              disabled={prefsBlockedReason !== null}
              describedBy={prefsDescribedBy}
            />
          </div>
        )}
        {colorOpen && (
          // Beside the revealed row, never inside it: see project-color-control.tsx.
          <ProjectColorPopover
            color={color}
            buttonRef={colorButtonRef}
            onPick={(next) => onPickColor(id, next)}
            onOpenChange={(open) => onColorOpenChange(id, open)}
          />
        )}
      </div>
    </li>
  );
}

type SortableProjectTileProps = Omit<ProjectTileProps, 'gripProps' | 'nodeRef' | 'style' | 'isDragging'>;

/** The tile in the Projects grid: dnd-kit's node on the `<li>`, its pointer listeners on the grip. */
export function SortableProjectTile(props: SortableProjectTileProps) {
  // v0.21.0 (O54): no drag while the person's settings cannot be read.
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.id,
    disabled: Boolean(props.dragBlockedReason),
  });
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
