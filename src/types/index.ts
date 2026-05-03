// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

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

export interface ChangeLogEntry {
  /** Operation that produced this entry */
  action: 'created' | 'imported' | 'uploaded' | 'shared' | 'cloned';
  /** ISO 8601 timestamp */
  timestamp: string;
  /** UID or workspace ID of the actor */
  actor: string;
  /** Optional human-readable detail */
  detail?: string;
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
  // Cloud metadata (set only by createProject, never by saveProject)
  owner?: string;
  members?: Record<string, 'owner' | 'editor' | 'viewer'>;
  schemaVersion?: string;
  // Fingerprinting
  _originRef?: string;
  _storageRef?: string;
  _changeLog?: ChangeLogEntry[];
}

export interface StorageIndex {
  version: string;
  activeProjectId: string | null;
  projectIds: string[];
}

/** Firestore document shape: users/{uid} */
export interface UserConsentRecord {
  acceptedAt: unknown;
  tosVersion: string;
  privacyPolicyVersion: string;
  appId: string;
  authProvider: string;
}

// ─── Invitations (v0.9.0, suite-wide collection) ─────────────

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

/**
 * Mirrors a spertsuite_invitations/{tokenId} document.
 * tokenId is the document id and is not redundantly stored on the doc itself.
 *
 * `modelId` is the suite-wide field name for "the thing being shared" — it
 * holds CFD's projectId in CFD-originated invitations. The shared schema
 * keeps the field name stable across SPERT apps. `isVoting` is also kept
 * on the type for cross-suite compatibility but is always false from CFD
 * and never rendered in the CFD UI (no voting concept).
 */
export interface PendingInvite {
  tokenId: string;
  appId: 'spertcfd' | string;
  modelId: string;
  modelName: string;
  inviteeEmail: string;
  role: 'owner' | 'editor' | 'viewer';
  isVoting: boolean;
  inviterUid: string;
  inviterName: string;
  inviterEmail: string;
  status: InvitationStatus;
  createdAt: number;
  expiresAt: number;
  lastEmailSentAt: number;
  emailSendCount: number;
  updatedAt: number;
  acceptedAt?: number;
  acceptedByUid?: string;
}
