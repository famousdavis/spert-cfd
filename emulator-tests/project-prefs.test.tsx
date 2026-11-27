// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.21.0 (DASH26 R2, P1, P2, P4): each person's tile colour and archive in
// spertcfd_settings/{uid}.projectPrefs, written by the real driver under the
// deployed rules, asserted as RAW documents read from the server
// (getDocFromServer): a write through `stripUndefined`, or `null` for
// `deleteField()`, passes any read through the sanitiser and is caught only
// here (DASH26 R2 pre-flight, shapes.json).
import { it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { doc, getDocs, updateDoc, query, collection, where, disableNetwork, enableNetwork, onSnapshot, type Firestore } from 'firebase/firestore'
// DIAGNOSTIC (draft PR, never merged): what the P1 test's first write did on CI.
import { getDocFromCache, getDocFromServer, waitForPendingWrites, setLogLevel } from 'firebase/firestore'
import type { StorageDriver } from '@/lib/storage-driver'
import type { Project } from '@/types'
import { client, closeClients, newProject, serverSettings, sleep, track, uniqueId, waitFor } from './helpers'

let driver: StorageDriver
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({ driver, mode: 'cloud' }),
}))

import { createFirestoreDriver } from '@/lib/firestore-driver'
import { PROJECTS_COL, SETTINGS_COL } from '@/lib/firestore-helpers'
import { migrateLocalToCloud, UploadError } from '@/lib/cloud-migration'
import { ProjectListProvider, useProjectList } from '@/contexts/project-list-context'

afterEach(closeClients)

/** The settings document as the server holds it (one reader device per user; see `serverSettings`). */
const raw = (uid: string) => serverSettings(uid)
/** Writes waiting are sent now, then the server is polled until `pred` holds. */
async function landed(d: StorageDriver, uid: string, pred: (data: Record<string, unknown> | null) => boolean) {
  const t = Date.now() // DIAGNOSTIC
  d.flush()
  let data = await raw(uid)
  let i = 0
  for (; i < 50 && !pred(data); i++) {
    await sleep(100)
    data = await raw(uid)
  }
  // DIAGNOSTIC: every wait, so a near miss in another test shows too.
  console.log(`[DIAG] landed ${pred(data) ? 'held' : 'NEVER held'} after ${Date.now() - t} ms, ${i} polls (${expect.getState().currentTestName})`)
  return data
}

/** DIAGNOSTIC: the settings document read with the owner token, bypassing the rules and every SDK client. */
async function ownerRead(uid: string) {
  const url = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${process.env.GCLOUD_PROJECT}/databases/(default)/documents/${SETTINGS_COL}/${uid}`
  try {
    const res = await fetch(url, { headers: { Authorization: 'Bearer owner' } })
    return `${res.status} ${(await res.text()).replace(/\s+/g, ' ').slice(0, 600)}`
  } catch (e) {
    return `threw ${String(e)}`
  }
}

/** DIAGNOSTIC: when P1's first write has not landed, where is it? */
async function diagnose(uid: string, db: Firestore, d: StorageDriver, t0: number, errors: unknown[][]) {
  const log = (...m: unknown[]) => console.log('[DIAG]', `+${Date.now() - t0} ms`, ...m)
  log('driver prefs read:', JSON.stringify(d.getProjectPrefs()))
  log('console.error so far:', JSON.stringify(errors.map((c) => c.map(String))))
  log('owner REST read:', await ownerRead(uid))
  try {
    const c = await getDocFromCache(doc(db, SETTINGS_COL, uid))
    log('writer cache: exists', c.exists(), 'data', JSON.stringify(c.data() ?? null), 'hasPendingWrites', c.metadata.hasPendingWrites)
  } catch (e) {
    log('writer cache read threw:', String(e))
  }
  const acked = await Promise.race([
    waitForPendingWrites(db).then(() => 'acknowledged', (e) => `rejected ${String(e)}`),
    sleep(20_000).then(() => 'STILL PENDING after 20 s more'),
  ])
  log('writer pending writes:', acked)
  log('owner REST read after:', await ownerRead(uid))
  try {
    const s = await getDocFromServer(doc(db, SETTINGS_COL, uid))
    log('writer server read: exists', s.exists(), 'data', JSON.stringify(s.data() ?? null))
  } catch (e) {
    log('writer server read threw:', String(e))
  }
  log('console.error at end:', JSON.stringify(errors.map((c) => c.map(String))))
}
const prefsOf = (data: Record<string, unknown> | null) => (data?.projectPrefs ?? null) as Record<string, unknown> | null
async function ready(uid: string, db?: Firestore) {
  const d = createFirestoreDriver(uid, db ?? client(uid))
  await d.loadProjectList()
  expect(d.getProjectPrefs().status).toBe('ready')
  return d
}
async function asOwner(uid: string, query: string, fields: Record<string, unknown>) {
  const url = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${process.env.GCLOUD_PROJECT}/databases/(default)/documents/${SETTINGS_COL}/${uid}${query}`
  const res = await fetch(url, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) })
  expect(res.ok).toBe(true)
}

it('P1: colour set and clear, archive set and clear, as raw documents; both cleared leaves {} under the id', async () => {
  const uid = uniqueId('u')
  // DIAGNOSTIC: the writer's own client, so its cache and pending writes can be read.
  const t0 = Date.now()
  const spy = vi.spyOn(console, 'error')
  if (process.env.SPERT_DIAG_SDK_DEBUG === '1') setLogLevel('debug')
  const db = client(uid)
  const d = await ready(uid, db)
  console.log('[DIAG]', `+${Date.now() - t0} ms`, 'ready; prefs read:', JSON.stringify(d.getProjectPrefs()))
  const a = uniqueId('a')
  expect(d.setProjectPref(a, 'color', 'blue')).toBeNull()
  const first = await landed(d, uid, (x) => !!prefsOf(x))
  setLogLevel('silent')
  if (!prefsOf(first)) await diagnose(uid, db, d, t0, spy.mock.calls)
  spy.mockRestore()
  expect(prefsOf(first)).toEqual({ [a]: { color: 'blue' } })
  d.setProjectPref(a, 'archived', true)
  expect(prefsOf(await landed(d, uid, (x) => (prefsOf(x)?.[a] as { archived?: true })?.archived === true))).toEqual({ [a]: { color: 'blue', archived: true } })
  // G1: a colour change on an archived tile keeps it archived.
  d.setProjectPref(a, 'color', 'teal')
  expect(prefsOf(await landed(d, uid, (x) => (prefsOf(x)?.[a] as { color?: string })?.color === 'teal'))).toEqual({ [a]: { color: 'teal', archived: true } })
  d.setProjectPref(a, 'color', undefined)
  expect(prefsOf(await landed(d, uid, (x) => !('color' in ((prefsOf(x)?.[a] ?? {}) as object))))).toEqual({ [a]: { archived: true } })
  d.setProjectPref(a, 'archived', undefined)
  const emptied = await landed(d, uid, (x) => !('archived' in ((prefsOf(x)?.[a] ?? {}) as object)))
  expect(prefsOf(emptied)).toEqual({ [a]: {} })
  expect(Object.keys(emptied ?? {}).sort()).toEqual(['projectPrefs']) // nothing else written (O41)
}, 60_000) // DIAGNOSTIC: room for diagnose()

it('P1: two fields changed together are one write, and the order writes leave projectPrefs as it was', async () => {
  const uid = uniqueId('u')
  const d = await ready(uid)
  const [p1, p2] = ['P1', 'P2'].map((n) => newProject(uniqueId('p'), n))
  for (const p of [p1, p2]) await d.createProject(p)
  d.setProjectPref(p1.id, 'color', 'pink')
  d.setProjectPref(p2.id, 'archived', true)
  const before = prefsOf(await landed(d, uid, (x) => Object.keys(prefsOf(x) ?? {}).length === 2))
  expect(before).toEqual({ [p1.id]: { color: 'pink' }, [p2.id]: { archived: true } })
  const ids = [p1.id, p2.id]
  expect(await d.moveProject({ draggedId: p2.id, targetId: p1.id, shownIds: ids, heldIds: ids })).toEqual({ kind: 'written', order: [p2.id, p1.id] })
  const after = await raw(uid)
  expect(after?.projectOrder).toEqual([p2.id, p1.id])
  expect(prefsOf(after)).toEqual(before)
})

it('P1, O60: a refused id writes nothing, and the device keeps working', async () => {
  const uid = uniqueId('u')
  const d = await ready(uid)
  for (const id of ['hasOwnProperty', 'toString', '__proto__', '']) expect(d.setProjectPref(id, 'archived', true)).toBe('refused-id')
  const p = newProject(uniqueId('p'), 'Fine')
  await d.createProject(p)
  d.setProjectPref(p.id, 'color', 'slate')
  expect(prefsOf(await landed(d, uid, (x) => !!prefsOf(x)))).toEqual({ [p.id]: { color: 'slate' } })
  expect((await d.loadProjectList()).map((x) => x.name)).toEqual(['Fine'])
})

it('P1, O55: Clone writes the copy\'s colour only; Delete drops both fields once the delete is made', async () => {
  const uid = uniqueId('u')
  driver = await ready(uid)
  const src = newProject(uniqueId('s'), 'Source')
  await driver.createProject(src)
  driver.setProjectPref(src.id, 'color', 'purple')
  driver.setProjectPref(src.id, 'archived', true)
  await landed(driver, uid, (x) => !!prefsOf(x))
  const { result } = renderHook(() => useProjectList(), { wrapper: ({ children }: { children: React.ReactNode }) => <ProjectListProvider>{children}</ProjectListProvider> })
  await act(async () => { await sleep(300) })
  let made = { id: '', name: '' }
  await act(async () => { made = await result.current.cloneProject(src as Project) })
  const cloned = prefsOf(await landed(driver, uid, (x) => !!prefsOf(x)?.[made.id]))
  expect(cloned).toEqual({ [src.id]: { color: 'purple', archived: true }, [made.id]: { color: 'purple' } })
  act(() => result.current.deleteProject(src.id))
  const dropped = prefsOf(await landed(driver, uid, (x) => Object.keys((prefsOf(x)?.[src.id] ?? { x: 1 }) as object).length === 0))
  expect(dropped).toEqual({ [src.id]: {}, [made.id]: { color: 'purple' } })
})

it('P4, O54: a read that failed is "failed", never "no settings"; at reconnect a list snapshot reads it again and it is ready', async () => {
  const uid = uniqueId('u')
  const seed = await ready(uid)
  const p = newProject(uniqueId('p'), 'Seeded')
  await seed.createProject(p)
  seed.setProjectPref(p.id, 'archived', true)
  await landed(seed, uid, (x) => !!prefsOf(x))
  const db = client(uid)
  await disableNetwork(db)
  const d = createFirestoreDriver(uid, db)
  await d.loadProjectList()
  expect(d.getProjectPrefs()).toEqual({ status: 'failed' })
  expect(d.setProjectPref(p.id, 'archived', undefined)).toBe('unread')
  const unsub = d.onProjectListChange(() => {})
  await enableNetwork(db)
  expect(await waitFor(() => d.getProjectPrefs().status === 'ready', 5000)).toBe(true)
  unsub()
  expect(d.getProjectPrefs()).toEqual({ status: 'ready', prefs: { [p.id]: { archived: true } } })
})

it('P4, §7 answer 1: retryProjectPrefs reads it again when no list snapshot comes (a person with no projects)', async () => {
  const uid = uniqueId('u')
  await asOwner(uid, '', { projectPrefs: { mapValue: { fields: { gone: { mapValue: { fields: { color: { stringValue: 'teal' } } } } } } } })
  const db = client(uid)
  await disableNetwork(db)
  const d = createFirestoreDriver(uid, db)
  await d.loadProjectList()
  expect(d.getProjectPrefs()).toEqual({ status: 'failed' })
  await enableNetwork(db)
  d.retryProjectPrefs()
  expect(await waitFor(() => d.getProjectPrefs().status === 'ready', 5000)).toBe(true)
  expect(d.getProjectPrefs()).toEqual({ status: 'ready', prefs: { gone: { color: 'teal' } } })
})

it('PR #115 review (Opus-PR115-1 -03): a read that failed while the list came from the cache recovers when the window takes focus, with no list snapshot and no `online` event', async () => {
  const uid = uniqueId('u')
  const seed = await ready(uid)
  const p = newProject(uniqueId('p'), 'Seeded')
  await seed.createProject(p)
  seed.setProjectPref(p.id, 'archived', true)
  await landed(seed, uid, (x) => !!prefsOf(x)?.[p.id])
  const db = client(uid)
  // Another listener keeps the list in this device's cache, as the app's own list listener does after any online session.
  track(onSnapshot(query(collection(db, PROJECTS_COL), where(`members.${uid}`, 'in', ['owner', 'editor', 'viewer'])), () => {}))
  await sleep(500)
  await disableNetwork(db)
  driver = createFirestoreDriver(uid, db)
  const { result } = renderHook(() => useProjectList(), { wrapper: ({ children }: { children: React.ReactNode }) => <ProjectListProvider>{children}</ProjectListProvider> })
  await act(async () => { await sleep(300) })
  expect(result.current.projects.map((x) => x.name)).toEqual(['Seeded']) // the list, from the cache
  expect(driver.getProjectPrefs()).toEqual({ status: 'failed' })
  await enableNetwork(db)
  await act(async () => { await sleep(1500) })
  // The case the review measured (PROBE-4): the list did not change, so no snapshot retried, and no `online` event came.
  expect(driver.getProjectPrefs()).toEqual({ status: 'failed' })
  act(() => { window.dispatchEvent(new Event('focus')) })
  expect(await waitFor(() => driver.getProjectPrefs().status === 'ready', 5000)).toBe(true)
  expect(driver.getProjectPrefs()).toEqual({ status: 'ready', prefs: { [p.id]: { archived: true } } })
})

it('P2: an archived tile left out of the shown ids keeps its slot through a drop', async () => {
  const uid = uniqueId('u')
  const d = await ready(uid)
  const [a, x, b, c] = ['A', 'X', 'B', 'C'].map((n) => newProject(uniqueId('p'), n))
  for (const p of [a, x, b, c]) await d.createProject(p)
  const held = [a.id, x.id, b.id, c.id]
  const shown = [a.id, b.id, c.id]
  const [first, second] = await Promise.all([
    d.moveProject({ draggedId: c.id, targetId: a.id, shownIds: shown, heldIds: held }), // C X A B
    d.moveProject({ draggedId: b.id, targetId: c.id, shownIds: shown, heldIds: held }), // then B onto C: B X C A
  ])
  expect(first).toEqual({ kind: 'written', order: [c.id, x.id, a.id, b.id] })
  expect(second).toEqual({ kind: 'written', order: [b.id, x.id, c.id, a.id] })
  expect((await raw(uid))?.projectOrder).toEqual([b.id, x.id, c.id, a.id])
})

it('P1, O64: the upload writes each project\'s entry under its cloud id, both fields masked', async () => {
  const uid = uniqueId('u')
  const db = client(uid)
  const cloud = createFirestoreDriver(uid, db)
  const local = [newProject(uniqueId('l'), 'L1'), newProject(uniqueId('l'), 'L2'), newProject(uniqueId('l'), 'L3')]
  const prefs = { [local[0].id]: { color: 'teal' as const }, [local[1].id]: { archived: true as const } }
  const result = await migrateLocalToCloud(uid, db, local, cloud, prefs)
  expect(result.uploaded).toBe(3)
  expect(result.prefsNotCarried).toEqual([])
  const cloudId = Object.fromEntries(result.pairs)
  expect(prefsOf(await raw(uid))).toEqual({ [cloudId[local[0].id]]: { color: 'teal' }, [cloudId[local[1].id]]: { archived: true } })
})

it('O64: a colour/archive write refused after the project landed names it, and every project lands once', async () => {
  const uid = uniqueId('u')
  const db = client(uid)
  const cloud = createFirestoreDriver(uid, db)
  await asOwner(uid, '', { stray: { booleanValue: true } }) // a key the rules refuse: every settings write is refused
  const local = [newProject(uniqueId('l'), 'L1'), newProject(uniqueId('l'), 'L2')]
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  const result = await migrateLocalToCloud(uid, db, local, cloud, { [local[1].id]: { archived: true } })
  errors.mockRestore()
  expect(result.uploaded).toBe(2)
  expect(result.prefsNotCarried).toEqual(['L2'])
  const listed = await getDocs(query(collection(client(uid), PROJECTS_COL), where(`members.${uid}`, 'in', ['owner', 'editor', 'viewer'])))
  expect(listed.docs.map((x) => x.data().name).sort()).toEqual(['L1', 'L2'])
})

it('PR #115 review (Opus-PR115-2 -09): a colour or archive write the rules refuse puts the map back from the server and is told', async () => {
  const uid = uniqueId('u')
  const d = await ready(uid)
  const [p1, p2] = ['Kept', 'Refused'].map((n) => newProject(uniqueId('p'), n))
  for (const p of [p1, p2]) await d.createProject(p)
  d.setProjectPref(p1.id, 'color', 'pink')
  await landed(d, uid, (x) => !!prefsOf(x)?.[p1.id])
  // A key the rules refuse, added beside what is stored: every later settings write is refused.
  await asOwner(uid, '?updateMask.fieldPaths=stray', { stray: { booleanValue: true } })
  let told = 0
  const unsubscribe = d.onProjectPrefsRefused(() => { told++ })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(d.setProjectPref(p2.id, 'archived', true)).toBeNull()
  expect(d.setProjectPref(p1.id, 'color', 'teal')).toBeNull()
  expect(d.getProjectPrefs()).toEqual({ status: 'ready', prefs: { [p1.id]: { color: 'teal' }, [p2.id]: { archived: true } } })
  d.flush()
  expect(await waitFor(() => told > 0, 10000)).toBe(true)
  unsubscribe()
  expect(told).toBe(1)
  expect(d.getProjectPrefs()).toEqual({ status: 'ready', prefs: { [p1.id]: { color: 'pink' } } })
  const stored = await raw(uid)
  expect(prefsOf(stored)).toEqual({ [p1.id]: { color: 'pink' } })
  expect(stored?.stray).toBe(true)
})

it('O64: a project that fails stops the upload with the pairs so far, and the projects before it carried their entries', async () => {
  const uid = uniqueId('u')
  const db = client(uid)
  const cloud = createFirestoreDriver(uid, db)
  const ok = newProject(uniqueId('l'), 'Fits')
  const tooBig = { ...newProject(uniqueId('l'), 'Too big'), name: 'x'.repeat(1_100_000) } // over Firestore's 1 MiB document
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  let caught: unknown
  try {
    await migrateLocalToCloud(uid, db, [ok, tooBig], cloud, { [ok.id]: { color: 'pink' }, [tooBig.id]: { archived: true } })
  } catch (err) {
    caught = err
  }
  errors.mockRestore()
  expect(caught).toBeInstanceOf(UploadError)
  const pairs = (caught as UploadError).pairs
  expect(pairs.map(([localId]) => localId)).toEqual([ok.id])
  expect(prefsOf(await raw(uid))).toEqual({ [pairs[0][1]]: { color: 'pink' } })
})

it('a delete the rules refuse because the project is already gone counts as made (PR #115 CI run 45112517962)', async () => {
  // What the SDK's retry of a delete whose first commit landed meets: no document. Made deterministic here by
  // deleting through another device first. Control: a project still there and not the person's to delete stays refused.
  const uid = uniqueId('u')
  const d = await ready(uid)
  const p = newProject(uniqueId('p'), 'Gone')
  await d.createProject(p)
  d.setProjectPref(p.id, 'archived', true)
  await landed(d, uid, (x) => !!prefsOf(x))
  await createFirestoreDriver(uid, client(uid)).deleteProject(p.id) // another device
  await expect(d.deleteProject(p.id)).resolves.toBeUndefined()

  const [ownerUid, editorUid] = [uniqueId('o'), uniqueId('e')]
  const ownerDb = client(ownerUid)
  const kept = newProject(uniqueId('k'), 'Kept')
  await createFirestoreDriver(ownerUid, ownerDb).createProject(kept)
  await updateDoc(doc(ownerDb, PROJECTS_COL, kept.id), { [`members.${editorUid}`]: 'editor' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await expect(createFirestoreDriver(editorUid, client(editorUid)).deleteProject(kept.id)).rejects.toMatchObject({ code: 'permission-denied' })
})
