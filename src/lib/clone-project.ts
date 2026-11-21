// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { ChangeLogEntry, Project } from '@/types';
import type { StorageDriver } from './storage-driver';
import { UNNAMED_PROJECT } from './cloud-load-guards';
import { generateUniqueCopyName, normalizeProjectName } from './import-utils';

/**
 * A clone's name (v0.19.0, DASH26 R15): "X (copy)", then "X (copy 2)", by the
 * import's own helper, against every listed name compared trimmed and
 * lowercased. X is the name the tile shows, so a cloud project whose name was
 * set aside clones as "Untitled project (copy)".
 */
export function cloneName(shownName: string, listedNames: readonly string[]): string {
  const taken = new Set(listedNames.map(normalizeProjectName));
  return generateUniqueCopyName(shownName || UNNAMED_PROJECT, taken);
}

export interface CloneOptions {
  id: string;
  name: string;
  /** ISO 8601: the copy's createdAt and updatedAt. */
  now: string;
  /** Cloud mode only: the cloner's uid, who the one history entry names. */
  cloudActor?: string;
}

/** A deep copy of plain JSON data, so the clone never shares an array or an object with its source. */
function copyOf<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * The project a Clone creates (v0.19.0, DASH26 R1b §2.1).
 *
 * ⚠️ An ALLOWLIST, never a spread of the source minus a denylist: only the
 * content (`workflow`, `snapshots`, `settings`), a new id and name, and "now".
 * Never the source's `owner`, `members`, `schemaVersion`, `_originRef`,
 * `_storageRef` or `_changeLog`, which a kept local copy of a cloud project
 * still carries: a spread would store them in a local clone, and the cloud
 * create path sets its own.
 *
 * In cloud mode the copy carries exactly one history entry, `'cloned'`, naming
 * the source in `detail`; the cloud create appends `'created'` after it
 * (O10, R23, R24: the shape an upload has). A local copy carries none.
 */
export function buildClone(source: Project, { id, name, now, cloudActor }: CloneOptions): Project {
  const clone: Project = {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    workflow: copyOf(source.workflow),
    snapshots: copyOf(source.snapshots),
    settings: copyOf(source.settings),
  };
  if (cloudActor !== undefined) {
    const entry: ChangeLogEntry = { action: 'cloned', timestamp: now, actor: cloudActor, detail: source.id };
    clone._changeLog = [entry];
  }
  return clone;
}

/**
 * What a Clone copies (v0.19.0, DASH26 O20): the open project's in-memory copy,
 * which holds any edit still inside the cloud save's debounce, but ONLY when
 * the LOADED copy is this project; otherwise the stored copy. Never keyed on
 * the list's active id: a switch changes it at once while the loaded copy is
 * still the previous project's (the trap written up in project-dashboard.tsx),
 * and a clone keyed on it took the previous project's data under this one's
 * name. Null when the project cannot be read.
 */
export async function cloneSource(
  loaded: Project | null,
  id: string,
  driver: Pick<StorageDriver, 'loadProject'>,
): Promise<Project | null> {
  if (loaded?.id === id) return loaded;
  return driver.loadProject(id).catch(() => null);
}
