// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { vi } from 'vitest'
import { initializeApp, deleteApp } from 'firebase/app'
import {
  initializeFirestore,
  memoryLocalCache,
  connectFirestoreEmulator,
  setLogLevel,
  terminate,
  type Firestore,
} from 'firebase/firestore'
import type { Project } from '@/types'

const HOST_PORT = process.env.FIRESTORE_EMULATOR_HOST
const PROJECT_ID = process.env.GCLOUD_PROJECT
// No emulator in the environment means this file was run without the
// launcher. Throwing here fails the run instead of letting the SDK look for a
// real backend.
if (!HOST_PORT || !PROJECT_ID) {
  throw new Error('Run the emulator tier with `npm run test:emulator`.')
}
const [HOST, PORT] = HOST_PORT.split(':')

// Denied writes are expected here and the SDK logs each one; keep the output
// terse (the ship gate captures it in a 1 MiB buffer).
setLogLevel('silent')

let seq = 0
const open: Array<() => Promise<void>> = []
const listening: Array<() => void> = []

/**
 * Registers a listener's unsubscribe for closeClients. A test that fails
 * before unsubscribing would otherwise leave the listener attached, and
 * closing its client then reports an `aborted` listener error into the NEXT
 * test's counters (measured: a red test made the one after it red too).
 */
export function track(unsubscribe: () => void) {
  listening.push(unsubscribe)
  return unsubscribe
}

/**
 * One device: its own Firestore instance and cache, signed in as `uid`
 * (the emulator trusts the mock token). Two clients with the same uid are the
 * same user on two devices.
 */
export function client(uid: string): Firestore {
  const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-key' }, `emu-${seq++}`)
  const db = initializeFirestore(app, { localCache: memoryLocalCache() })
  connectFirestoreEmulator(db, HOST, Number(PORT), { mockUserToken: { user_id: uid } })
  open.push(async () => {
    await terminate(db)
    await deleteApp(app)
  })
  return db
}

/** Unsubscribes every tracked listener, then closes every client opened since the last call (use in afterEach). */
export async function closeClients() {
  for (const unsubscribe of listening.splice(0)) unsubscribe()
  await Promise.all(open.splice(0).map((done) => done()))
}

/** Unique per call, so tests never share a document or a user's settings. */
export function uniqueId(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/** The project ProjectListProvider.createProject builds. */
export function newProject(id: string, name = `Project ${id}`): Project {
  const now = new Date().toISOString()
  return {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    workflow: [
      { id: 'backlog', name: 'Backlog', color: '#64748b', category: 'backlog', order: 0 },
      { id: 'dev', name: 'In Dev', color: '#3b82f6', category: 'active', order: 1 },
      { id: 'done', name: 'Done', color: '#22c55e', category: 'done', order: 2 },
    ],
    snapshots: [],
    settings: { gridSortNewestFirst: true, showWipWarnings: true, metricsPeriod: { kind: 'all' } },
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Polls until `pred` holds or `ms` passes; returns whether it held. */
export async function waitFor(pred: () => boolean, ms = 10_000) {
  const until = Date.now() + ms
  while (!pred() && Date.now() < until) await sleep(20)
  return pred()
}

/** 'resolved', or 'rejected:<code>' — so a denial is asserted by its code. */
export function outcome(p: Promise<unknown>): Promise<string> {
  return p.then(
    () => 'resolved',
    (e: { code?: string }) => `rejected:${e.code ?? String(e)}`,
  )
}

/**
 * Counts what the driver reports when a listener is denied: the
 * `spert:project-access-revoked` event and its console.error line. A count
 * of zero means nothing only beside a test where it is not zero, which is
 * controls.test.ts's job.
 */
export function watchRevocations() {
  const revoked: string[] = []
  const onRevoked = (e: Event) => revoked.push((e as CustomEvent<{ id: string }>).detail.id)
  window.addEventListener('spert:project-access-revoked', onRevoked)
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  return {
    revoked,
    listenerErrors: () => errors.mock.calls.filter((c) => c[0] === 'onProjectChange listener error:').length,
    stop: () => {
      window.removeEventListener('spert:project-access-revoked', onRevoked)
      errors.mockRestore()
    },
  }
}
