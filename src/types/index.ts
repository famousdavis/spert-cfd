export type StateCategory = 'backlog' | 'active' | 'done';

export interface WorkflowState {
  id: string;
  name: string;
  color: string;
  category: StateCategory;
  wipLimit?: number;
  order: number;
}

export interface Snapshot {
  /** ISO 8601 date string, e.g. "2024-01-15" */
  date: string;
  /** Maps WorkflowState.id → count of items in that state */
  counts: Record<string, number>;
}

export type MetricsPeriod =
  | { kind: 'all' }
  | { kind: 'days'; value: number }
  | { kind: 'range'; start: string; end: string };

export interface ProjectSettings {
  gridSortNewestFirst: boolean;
  showWipWarnings: boolean;
  metricsPeriod: MetricsPeriod;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  workflow: WorkflowState[];
  snapshots: Snapshot[];
  settings: ProjectSettings;
  /** Data schema version for migrations */
  _version?: string;
}

export interface StorageIndex {
  version: string;
  activeProjectId: string | null;
  projectIds: string[];
}
