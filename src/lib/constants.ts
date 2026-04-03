// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

export const APP_VERSION = '0.5.1';

/** Maximum file size for CSV and JSON imports (1MB) */
export const MAX_IMPORT_FILE_SIZE = 1 * 1024 * 1024;

/** Maximum length for project and workflow state names */
export const MAX_NAME_LENGTH = 200;

/** Current ToS acceptance version (date-based) */
export const TOS_VERSION = '03-31-2026';

/** App identifier for Firestore consent records */
export const APP_ID = 'spert-cfd';

/** External legal document URLs (hosted on landing site) */
export const SPERT_SUITE_URL = 'https://spertsuite.com';
export const TOS_URL = 'https://spertsuite.com/TOS.pdf';
export const PRIVACY_URL = 'https://spertsuite.com/PRIVACY.pdf';
export const LICENSE_URL = 'https://github.com/famousdavis/spert-cfd/blob/main/LICENSE';

/** localStorage keys for consent flow */
export const LS_FIRST_RUN_SEEN = 'spert_firstRun_seen';
export const LS_TOS_ACCEPTED_VERSION = 'spert_tos_accepted_version';
export const LS_TOS_WRITE_PENDING = 'spert_tos_write_pending';
export const LS_SUPPRESS_LS_WARNING = 'spert_suppress_ls_warning';
