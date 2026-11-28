// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.20.2 (DASH26 R2o, O53a): a drop is a MOVE applied to the order read now,
// under the deployed rules. At 3463be9 the tab's own list was written as given
// (measured, DASH26 R2 pre-flight, order-base.json): a tab left open undid
// another device's reorder (B A C D where this gives D C A B), and a project
// the tab had not listed lost its place (B A where this gives B C A).
import { it, expect, afterEach, vi } from 'vitest'
import { doc, getDocs, updateDoc, query, collection, where, disableNetwork, enableNetwork } from 'firebase/firestore'
import { createFirestoreDriver } from '@/lib/firestore-driver'
import type { ProjectMove } from '@/lib/storage-driver'
import { buildClone } from '@/lib/clone-project'
import { PROJECTS_COL, SETTINGS_COL } from '@/lib/firestore-helpers'
import { client, closeClients, newProject, serverSettings, sleep, uniqueId } from './helpers'

afterEach(closeClients)

/** The stored order as the server holds it (see `serverSettings`), as names. */
async function storedNames(uid: string, names: Record<string, string>) {
  const order = ((await serverSettings(uid))?.projectOrder ?? []) as string[]
  return order.map((id) => names[id] ?? id)
}
const move = (draggedId: string, targetId: string, held: string[], shown = held): ProjectMove =>
  ({ draggedId, targetId, shownIds: shown, heldIds: held })

it("P-A1: another device's reorder survives a drop in a tab still holding the old order", async () => {
  const uid = uniqueId('u')
  const here = createFirestoreDriver(uid, client(uid))
  const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((n) => newProject(uniqueId('p'), n))
  for (const p of [a, b, c, d]) await here.createProject(p)
  const held = (await here.loadProjectList()).map((p) => p.id) // A B C D
  const names = Object.fromEntries([a, b, c, d].map((p) => [p.id, p.name]))
  const elsewhere = createFirestoreDriver(uid, client(uid))
  for (const [dragged, target] of [[d, a], [c, a], [b, a]]) await elsewhere.moveProject(move(dragged.id, target.id, held)) // D C B A
  expect(await storedNames(uid, names)).toEqual(['D', 'C', 'B', 'A'])

  const outcome = await here.moveProject(move(a.id, b.id, held)) // A onto B
  expect(outcome).toEqual({ kind: 'written', order: [d.id, c.id, a.id, b.id] })
  expect(await storedNames(uid, names)).toEqual(['D', 'C', 'A', 'B'])
})

it('P-A2: a project another device created, unseen here, keeps its slot', async () => {
  const uid = uniqueId('u')
  const here = createFirestoreDriver(uid, client(uid))
  const [a, b, c] = ['A', 'B', 'C'].map((n) => newProject(uniqueId('p'), n))
  for (const p of [a, b]) await here.createProject(p)
  const held = (await here.loadProjectList()).map((p) => p.id) // A B
  const names = Object.fromEntries([a, b, c].map((p) => [p.id, p.name]))
  await createFirestoreDriver(uid, client(uid)).createProject(c, { after: a.id, shownIds: held }) // A C B
  expect(await storedNames(uid, names)).toEqual(['A', 'C', 'B'])

  await here.moveProject(move(b.id, a.id, held))
  expect(await storedNames(uid, names)).toEqual(['B', 'C', 'A'])
})

it('P-A2: a shared project the stored order lacks is placed by a drop', async () => {
  const [ownerUid, meUid] = [uniqueId('owner'), uniqueId('me')]
  const ownerDb = client(ownerUid)
  const owner = createFirestoreDriver(ownerUid, ownerDb)
  const me = createFirestoreDriver(meUid, client(meUid))
  const [a, b] = ['A', 'B'].map((n) => newProject(uniqueId('p'), n))
  for (const p of [a, b]) await me.createProject(p) // stored A B
  const x = newProject(uniqueId('px'), 'X')
  await owner.createProject(x)
  await updateDoc(doc(ownerDb, PROJECTS_COL, x.id), { [`members.${meUid}`]: 'viewer' })
  const names = Object.fromEntries([a, b, x].map((p) => [p.id, p.name]))
  const held = (await me.loadProjectList()).map((p) => p.id)
  expect(held.map((id) => names[id])).toEqual(['A', 'B', 'X']) // X unordered, last

  expect(await me.moveProject(move(x.id, a.id, held))).toEqual({ kind: 'written', order: [x.id, a.id, b.id] })
  expect(await storedNames(meUid, names)).toEqual(['X', 'A', 'B'])
})

it('P-A3: an offline drop in a tab that has read an order is queued, and lands on reconnect', async () => {
  const uid = uniqueId('u')
  const db = client(uid)
  const here = createFirestoreDriver(uid, db)
  const [a, b, c] = ['A', 'B', 'C'].map((n) => newProject(uniqueId('p'), n))
  for (const p of [a, b, c]) await here.createProject(p)
  const held = (await here.loadProjectList()).map((p) => p.id)
  const names = Object.fromEntries([a, b, c].map((p) => [p.id, p.name]))
  await disableNetwork(db)
  // Outcomes wait for the server, so they settle on reconnect; the second drop
  // builds on the first (lastOrder), not on what the server holds.
  const first = here.moveProject(move(c.id, a.id, held))
  const second = here.moveProject(move(b.id, c.id, [c.id, a.id, b.id]))
  await sleep(300)
  expect(await storedNames(uid, names)).toEqual(['A', 'B', 'C']) // not sent while offline
  await enableNetwork(db)
  expect(await first).toEqual({ kind: 'written', order: [c.id, a.id, b.id] })
  expect(await second).toEqual({ kind: 'written', order: [b.id, c.id, a.id] })
  expect(await storedNames(uid, names)).toEqual(['B', 'C', 'A'])
})

it("P-A3 (W2): with no settings document yet, an offline drop is still written: a read that found none counts as []", async () => {
  // A person with only shared projects has no settings document. Offline, a
  // read of a document that did not exist rejects, it does not answer "none"
  // from the cache (DASH26 R2 pre-flight R05), so the driver's own last read
  // is what the drop builds on.
  const [ownerUid, meUid] = [uniqueId('owner'), uniqueId('me')]
  const ownerDb = client(ownerUid)
  const owner = createFirestoreDriver(ownerUid, ownerDb)
  const [x, y] = ['X', 'Y'].map((n) => newProject(uniqueId('p'), n))
  for (const p of [x, y]) {
    await owner.createProject(p)
    await updateDoc(doc(ownerDb, PROJECTS_COL, p.id), { [`members.${meUid}`]: 'viewer' })
  }
  const names = Object.fromEntries([x, y].map((p) => [p.id, p.name]))
  const db = client(meUid)
  const me = createFirestoreDriver(meUid, db)
  const held = (await me.loadProjectList()).map((p) => p.id)
  expect(held).toHaveLength(2)
  expect(await serverSettings(meUid)).toBeNull() // fixture: no document
  await disableNetwork(db)
  const moved = me.moveProject(move(held[1], held[0], held))
  await sleep(300)
  await enableNetwork(db)
  expect(await moved).toEqual({ kind: 'written', order: [held[1], held[0]] })
  expect(await storedNames(meUid, names)).toEqual([held[1], held[0]].map((id) => names[id]))
})

it("P-A3: a tab that never read an order writes nothing, and nothing lands on reconnect", async () => {
  const uid = uniqueId('u')
  const seed = createFirestoreDriver(uid, client(uid))
  const [a, b, c] = ['A', 'B', 'C'].map((n) => newProject(uniqueId('p'), n))
  for (const p of [a, b, c]) await seed.createProject(p)
  const names = Object.fromEntries([a, b, c].map((p) => [p.id, p.name]))
  // A device whose cache holds the project list but never the settings document.
  const db = client(uid)
  await getDocs(query(collection(db, PROJECTS_COL), where(`members.${uid}`, 'in', ['owner', 'editor', 'viewer'])))
  await disableNetwork(db)
  const here = createFirestoreDriver(uid, db)
  const held = (await here.loadProjectList()).map((p) => p.id)
  expect(held).toHaveLength(3) // tiles on screen
  expect(await here.moveProject(move(c.id, a.id, held))).toEqual({ kind: 'unread' })
  await enableNetwork(db)
  await sleep(500)
  expect(await storedNames(uid, names)).toEqual(['A', 'B', 'C'])
})

it('two quick drops each build on the one before (the second read sees the first write while it is pending)', async () => {
  const uid = uniqueId('u')
  const here = createFirestoreDriver(uid, client(uid))
  const [a, b, c] = ['A', 'B', 'C'].map((n) => newProject(uniqueId('p'), n))
  for (const p of [a, b, c]) await here.createProject(p)
  const held = (await here.loadProjectList()).map((p) => p.id)
  const names = Object.fromEntries([a, b, c].map((p) => [p.id, p.name]))
  const [first, second] = await Promise.all([
    here.moveProject(move(c.id, a.id, held)), // C A B
    here.moveProject(move(b.id, c.id, held)), // then B onto C in C A B: B C A
  ])
  expect(first).toEqual({ kind: 'written', order: [c.id, a.id, b.id] })
  expect(second).toEqual({ kind: 'written', order: [b.id, c.id, a.id] })
  expect(await storedNames(uid, names)).toEqual(['B', 'C', 'A'])
})

it('a clone and a drop started together take turns: both land', async () => {
  const uid = uniqueId('u')
  const here = createFirestoreDriver(uid, client(uid))
  const [a, b, c] = ['A', 'B', 'C'].map((n) => newProject(uniqueId('p'), n))
  for (const p of [a, b, c]) await here.createProject(p)
  const held = (await here.loadProjectList()).map((p) => p.id)
  const copy = buildClone(a, { id: uniqueId('k'), name: 'A (copy)', now: new Date().toISOString(), cloudActor: uid })
  const names = Object.fromEntries([a, b, c, copy].map((p) => [p.id, p.name]))
  await Promise.all([
    here.createProject(copy, { after: a.id, shownIds: held }), // A A(copy) B C
    here.moveProject(move(c.id, a.id, [...held, copy.id])), // C onto A
  ])
  await sleep(300) // the placement's order write is not awaited by the create
  expect(await storedNames(uid, names)).toEqual(['C', 'A', 'A (copy)', 'B'])
})

// PR #114 review -06 (M9). The server refuses a move only when the settings
// document holds a key the rules do not allow; such a document is set up here
// with the emulator's rules-bypassing owner token, which no client has.
async function asOwner(uid: string, query: string, fields: Record<string, unknown>) {
  const url = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${process.env.GCLOUD_PROJECT}/databases/(default)/documents/${SETTINGS_COL}/${uid}${query}`
  const res = await fetch(url, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) })
  expect(res.ok).toBe(true)
}
const ids = (xs: string[]) => ({ arrayValue: { values: xs.map((stringValue) => ({ stringValue })) } })

it('a move the server refuses is failed, and a later offline drop builds on the order it was made on, not the refused one', async () => {
  const uid = uniqueId('u')
  const db = client(uid)
  const here = createFirestoreDriver(uid, db)
  const [a, b, c] = ['A', 'B', 'C'].map((n) => newProject(uniqueId('p'), n))
  for (const p of [a, b, c]) await here.createProject(p)
  const held = (await here.loadProjectList()).map((p) => p.id)
  const names = Object.fromEntries([a, b, c].map((p) => [p.id, p.name]))
  await asOwner(uid, '', { projectOrder: ids(held), stray: { booleanValue: true } }) // a key outside the allowlist
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(await here.moveProject(move(c.id, a.id, held))).toEqual({ kind: 'failed' }) // C onto A: refused
  errors.mockRestore()
  expect(await storedNames(uid, names)).toEqual(['A', 'B', 'C'])

  await disableNetwork(db)
  const later = here.moveProject(move(b.id, a.id, held)) // B onto A, built on A B C (not on the refused C A B)
  await asOwner(uid, '?updateMask.fieldPaths=stray', {}) // the stray key goes, so the queued write can land
  await enableNetwork(db)
  expect(await later).toEqual({ kind: 'written', order: [b.id, a.id, c.id] })
  expect(await storedNames(uid, names)).toEqual(['B', 'A', 'C'])
})

// PR #114 review -03, kept as a test of the documented limit: an offline drop
// builds on the order this tab last read, so when it lands on reconnect it
// replaces an order another device stored meanwhile, as before v0.20.2. The
// changelog says so; this pins it, so a change here is a change to that text.
it('an offline drop, sent on reconnect, replaces an order another device stored meanwhile (the documented limit)', async () => {
  const uid = uniqueId('u')
  const db = client(uid)
  const here = createFirestoreDriver(uid, db)
  const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((n) => newProject(uniqueId('p'), n))
  for (const p of [a, b, c, d]) await here.createProject(p)
  const held = (await here.loadProjectList()).map((p) => p.id) // A B C D, read
  const names = Object.fromEntries([a, b, c, d].map((p) => [p.id, p.name]))
  await disableNetwork(db)
  const elsewhere = createFirestoreDriver(uid, client(uid))
  for (const [dragged, target] of [[d, a], [c, a], [b, a]]) await elsewhere.moveProject(move(dragged.id, target.id, held))
  expect(await storedNames(uid, names)).toEqual(['D', 'C', 'B', 'A'])
  const offline = here.moveProject(move(a.id, b.id, held)) // A onto B, on A B C D
  await sleep(200)
  await enableNetwork(db)
  expect(await offline).toEqual({ kind: 'written', order: [b.id, a.id, c.id, d.id] })
  expect(await storedNames(uid, names)).toEqual(['B', 'A', 'C', 'D'])
})
