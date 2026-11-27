// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/** The sample's name (contract §7, "Load Sample": every sample is named "Sample: …"). */
export const SAMPLE_PROJECT_NAME = 'Sample: 2-Week Sprint';

/**
 * The name for a new copy of the sample (v0.23.0, FRAME26 clean-up L): the
 * sample's own name while no project has it, else the lowest free
 * "Sample: 2-Week Sprint (n)", n ≥ 2. Pass EVERY project's name: archived
 * ones and, in cloud mode, the ones shared with this person hold a name too.
 * Exact match only. Until v0.23.0 every copy took the same name.
 */
export function sampleProjectName(existingNames: Iterable<string>): string {
  const taken = new Set(existingNames);
  if (!taken.has(SAMPLE_PROJECT_NAME)) return SAMPLE_PROJECT_NAME;
  let n = 2;
  while (taken.has(`${SAMPLE_PROJECT_NAME} (${n})`)) n++;
  return `${SAMPLE_PROJECT_NAME} (${n})`;
}

/** What Load Sample announces once the copy is saved and open (contract §7). */
export function sampleLoadedText(name: string): string {
  return `Added “${name}” to your projects and opened it.`;
}
