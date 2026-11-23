// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

export const APP_VERSION = '0.20.2';

/** The tagline under the header's title, the About tab's subtitle and the page's
 *  metadata description (v0.17.9). One constant, so they never disagree:
 *  SPERT® Forecaster likewise uses one constant for its header and About tab. */
export const APP_DESCRIPTION = 'Cumulative Flow Diagram tool for agile teams';

/**
 * Maximum file size for CSV and JSON imports (5 MB).
 * Sizing: 30 projects × 365 snapshots × ~150 bytes/snapshot ≈ 1.6 MB; 5 MB
 * provides 3× headroom for multi-project workspace imports.
 */
export const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;

/** Maximum length for project and workflow state names */
export const MAX_NAME_LENGTH = 200;

/** Current ToS acceptance version (date-based) */
export const TOS_VERSION = '10-26-2026';

/** App identifier for Firestore consent records */
export const APP_ID = 'spert-cfd';

/** External legal document URLs (hosted on landing site) */
export const SPERT_SUITE_URL = 'https://spertsuite.com';
export const TOS_URL = 'https://spertsuite.com/TOS.pdf';
export const PRIVACY_URL = 'https://spertsuite.com/PRIVACY.pdf';
export const LICENSE_URL = 'https://github.com/famousdavis/spert-cfd/blob/main/LICENSE';

/** This app's page in the SPERT® Suite Help Center, linked from the end of the
 *  tab bar (v0.17.8). ⚠️ Tests must NOT import this: they compare the href with
 *  the literal address, so a wrong slug written here turns them red. */
export const HELP_CENTER_URL = 'https://spertsuite.com/help/cfd';

/** localStorage keys for consent flow */
export const LS_FIRST_RUN_SEEN = 'spert_firstRun_seen';
export const LS_TOS_ACCEPTED_VERSION = 'spert_tos_accepted_version';
export const LS_TOS_WRITE_PENDING = 'spert_tos_write_pending';
export const LS_SUPPRESS_LS_WARNING = 'spert_suppress_ls_warning';

/** localStorage keys for storage driver */
export const LS_ACTIVE_PROJECT = 'spertcfd-active-project';
export const LS_STORAGE_MODE = 'spertcfd-storage-mode';
export const LS_WORKSPACE_ID = 'spertcfd-workspace-id';
/**
 * v0.19.0 (DASH26 R26): an invite link opened with no local projects asks for
 * Cloud at the next sign-in, which takes it only if the local list is still
 * empty then (`use-invitation-landing.ts`). Until v0.18.0 the link switched the
 * storage preference to Cloud at once.
 */
export const LS_INVITE_CLOUD_PENDING = 'spertcfd-invite-cloud-pending';

/** Firestore document schema version. Written once by createProject.
 *  saveProject intentionally omits it (mergeFields exclusion preserves
 *  the existing value). Update when adding a PROJECT_MIGRATIONS entry. */
export const SCHEMA_VERSION = '0.7.0';

/** Debounce delay for cloud Firestore writes (ms).
 *  200ms closes the click-loss window on hard tab kills without
 *  meaningfully increasing write volume. Local saves are synchronous. */
export const DEBOUNCE_CLOUD_MS = 200;

/** localStorage key for migration flag */
export const LS_HAS_UPLOADED = 'spertcfd-has-uploaded-to-cloud';
