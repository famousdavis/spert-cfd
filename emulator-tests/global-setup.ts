// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { appendFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import type { TestProject } from 'vitest/node'

export interface RulesLoaded {
  repo: string
  commit: string
  path: string
  md5: string
}

declare module 'vitest' {
  export interface ProvidedContext {
    rulesLoaded: RulesLoaded
  }
}

/**
 * Loads the pinned rules into the emulator BEFORE any test file runs.
 *
 * The rules go in by PUT to the emulator's securityRules endpoint (what
 * @firebase/rules-unit-testing does), not through firebase.json. That way the
 * md5 asserted here is the md5 of the exact bytes the emulator enforces. An
 * emulator given no rules allows every read and write, so every test would
 * pass: tests in controls.test.ts prove the rules are in force.
 */
export default async function setup(project: TestProject) {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  const projectId = process.env.GCLOUD_PROJECT
  const rulesFile = process.env.SPERT_RULES_FILE
  if (!host || !projectId || !rulesFile) {
    throw new Error('The emulator tier runs only under `npm run test:emulator` (no emulator or rules file in the environment).')
  }

  const pin: RulesLoaded = JSON.parse(readFileSync(path.join(__dirname, 'rules-pin.json'), 'utf8'))
  const bytes = readFileSync(rulesFile)
  const md5 = createHash('md5').update(bytes).digest('hex')
  if (md5 !== pin.md5) throw new Error(`rules md5 ${md5} != pinned ${pin.md5} (${rulesFile})`)
  const content = bytes.toString('utf8')
  if (!Buffer.from(content, 'utf8').equals(bytes)) throw new Error('rules file is not valid UTF-8')

  const res = await fetch(`http://${host}/emulator/v1/projects/${projectId}:securityRules`, {
    method: 'PUT',
    body: JSON.stringify({ rules: { files: [{ content }] } }),
  })
  if (!res.ok) throw new Error(`loading the rules into the emulator: HTTP ${res.status} ${await res.text()}`)

  const line = `rules in force: ${pin.repo}@${pin.commit} ${pin.path} md5 ${md5}`
  console.log(line)
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Emulator tier\n\n${line}\n\n`)
  }
  project.provide('rulesLoaded', { ...pin, md5 })
}
