// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.19.0 (DASH26 R1b): Clone on the real cloud driver, under the deployed rules.
// The copy is built by buildClone, as ProjectListContext.cloneProject builds it,
// and created with the positioned create (placement after its source).
// - P4 fields: owner, the only members key and _originRef are the cloner's uid;
//   schemaVersion; the history exactly 'cloned' (the source in detail) then
//   'created'; a viewer's clone the same.
// - O22 placement: (a)+(d) the moment the create resolves, a fresh client reads
//   the copy after its source, and an order another device wrote survives;
//   (b) a viewer's clone of the second of two unordered shared projects; (c) a
//   failed order read leaves the stored order as it was, plus the append; F1
//   two clones started together.
// - F3: the copy can be read the moment the create is called (a tile's stats).
// - O20: an edit inside the 200 ms save debounce reaches the copy.
// - A refused create rejects, and nothing is written.
import { it, expect, afterEach } from 'vitest'
import { doc, getDoc, updateDoc, disableNetwork, enableNetwork } from 'firebase/firestore'
import { createFirestoreDriver } from '@/lib/firestore-driver'
import { buildClone, cloneSource } from '@/lib/clone-project'
import { PROJECTS_COL, SETTINGS_COL } from '@/lib/firestore-helpers'
import { SCHEMA_VERSION } from '@/lib/constants'
import type { Project } from '@/types'
import { client, closeClients, newProject, outcome, sleep, uniqueId } from './helpers'

afterEach(closeClients)

const cloneOf = (source: Project, name: string, actor: string) =>
  buildClone(source, { id: uniqueId('k'), name, now: new Date().toISOString(), cloudActor: actor })

/** A fresh device's list: what a reload shows. */
const freshNames = async (uid: string) =>
  (await createFirestoreDriver(uid, client(uid)).loadProjectList()).map((p) => p.name)

const storedOrder = async (uid: string) =>
  ((await getDoc(doc(client(uid), SETTINGS_COL, uid))).data()?.projectOrder ?? []) as string[]

it('P4 fields: the copy is the cloner\'s, with exactly a \'cloned\' then a \'created\' entry; a viewer\'s clone the same', async () => {
  const [ownerUid, viewerUid] = [uniqueId('owner'), uniqueId('viewer')]
  const ownerDb = client(ownerUid)
  const owner = createFirestoreDriver(ownerUid, ownerDb)
  const viewer = createFirestoreDriver(viewerUid, client(viewerUid))
  const source = { ...newProject(uniqueId('s'), 'Source'), snapshots: [{ date: '2026-06-01', counts: { backlog: 4, dev: 1, done: 2 } }] }
  await owner.createProject(source)
  await updateDoc(doc(ownerDb, PROJECTS_COL, source.id), { [`members.${viewerUid}`]: 'viewer' })

  for (const [who, uid, driver] of [['owner', ownerUid, owner], ['viewer', viewerUid, viewer]] as const) {
    const full = (await driver.loadProject(source.id))!
    const clone = cloneOf(full, 'Source (copy)', uid)
    await driver.createProject(clone, { after: source.id, shownIds: [source.id] })
    const data = (await getDoc(doc(client(uid), PROJECTS_COL, clone.id))).data()!
    expect(data.owner, who).toBe(uid)
    expect(data.members, who).toEqual({ [uid]: 'owner' })
    expect(data._originRef, who).toBe(uid)
    expect(data.schemaVersion, who).toBe(SCHEMA_VERSION)
    expect(data._changeLog.map((e: { action: string }) => e.action), who).toEqual(['cloned', 'created'])
    expect(data._changeLog[0], who).toMatchObject({ actor: uid, detail: source.id })
    expect(data._changeLog[1], who).toMatchObject({ actor: uid })
    expect({ workflow: data.workflow, snapshots: data.snapshots, settings: data.settings }, who)
      .toEqual({ workflow: source.workflow, snapshots: source.snapshots, settings: source.settings })
    expect(data.createdAt, who).not.toBe(source.createdAt)
  }
})

it('O22 (a)+(d): the moment the create resolves, a fresh client reads the copy after its source; another device\'s order survives', async () => {
  const uid = uniqueId('u')
  const db = client(uid)
  const here = createFirestoreDriver(uid, db)
  const [s1, s2, s3] = [newProject(uniqueId('a'), 'S1'), newProject(uniqueId('b'), 'S2'), newProject(uniqueId('c'), 'S3')]
  for (const p of [s1, s2, s3]) await here.createProject(p)
  const shown = (await here.loadProjectList()).map((p) => p.id) // this tab: S1, S2, S3
  await createFirestoreDriver(uid, client(uid)).reorderProjects([s2.id, s1.id, s3.id]) // a device this tab never heard
  await here.createProject(cloneOf(s1, 'S1 (copy)', uid), { after: s1.id, shownIds: shown })
  expect(await freshNames(uid)).toEqual(['S2', 'S1', 'S1 (copy)', 'S3'])
})

it('O22 (b), F2: a viewer\'s clone of the SECOND of two unordered shared projects lands right after it, also after a reload', async () => {
  const [ownerUid, viewerUid] = [uniqueId('owner'), uniqueId('viewer')]
  const ownerDb = client(ownerUid)
  const owner = createFirestoreDriver(ownerUid, ownerDb)
  const viewer = createFirestoreDriver(viewerUid, client(viewerUid))
  await viewer.createProject(newProject(uniqueId('m'), 'V own'))
  // Document ids order the unordered tail: 'pa…' before 'pb…'.
  const [sha, shb] = [newProject(uniqueId('pa'), 'ShA'), newProject(uniqueId('pb'), 'ShB')]
  for (const p of [sha, shb]) {
    await owner.createProject(p)
    await updateDoc(doc(ownerDb, PROJECTS_COL, p.id), { [`members.${viewerUid}`]: 'viewer' })
  }
  const shown = await viewer.loadProjectList()
  expect(shown.map((p) => `${p.name}:${p.role}`)).toEqual(['V own:owner', 'ShA:viewer', 'ShB:viewer']) // fixture
  await viewer.createProject(cloneOf(shb, 'ShB (copy)', viewerUid), { after: shb.id, shownIds: shown.map((p) => p.id) })
  expect((await viewer.loadProjectList()).map((p) => p.name)).toEqual(['V own', 'ShA', 'ShB', 'ShB (copy)'])
  expect(await freshNames(viewerUid)).toEqual(['V own', 'ShA', 'ShB', 'ShB (copy)'])
})

it('O22 (c): a failed order read (a device offline) leaves the stored order as it was, plus the create\'s append', async () => {
  const uid = uniqueId('u')
  const seed = createFirestoreDriver(uid, client(uid))
  const [s1, s2, s3] = [newProject(uniqueId('a'), 'S1'), newProject(uniqueId('b'), 'S2'), newProject(uniqueId('c'), 'S3')]
  for (const p of [s1, s2, s3]) await seed.createProject(p)
  await seed.reorderProjects([s3.id, s1.id, s2.id])
  const db = client(uid) // a device with nothing cached, offline
  await disableNetwork(db)
  const clone = cloneOf(s1, 'S1 (copy)', uid)
  const created = createFirestoreDriver(uid, db).createProject(clone, { after: s1.id, shownIds: [s3.id, s1.id, s2.id] })
  await sleep(300)
  await enableNetwork(db)
  await created
  expect(await storedOrder(uid)).toEqual([s3.id, s1.id, s2.id, clone.id])
})

it('F1: two clones of one source started together: a fresh client reads the order the screen shows (x3)', async () => {
  const results: string[][] = []
  for (let run = 0; run < 3; run++) {
    const uid = uniqueId('u')
    const d = createFirestoreDriver(uid, client(uid))
    const [s1, s2] = [newProject(uniqueId('a'), 'S1'), newProject(uniqueId('b'), 'S2')]
    for (const p of [s1, s2]) await d.createProject(p)
    const c1 = cloneOf(s1, 'S1 (copy)', uid)
    const c2 = cloneOf(s1, 'S1 (copy 2)', uid)
    // On screen (insertAfter): S1, S1 (copy), S2, then S1, S1 (copy 2), S1 (copy), S2.
    await Promise.all([
      d.createProject(c1, { after: s1.id, shownIds: [s1.id, s2.id] }),
      d.createProject(c2, { after: s1.id, shownIds: [s1.id, c1.id, s2.id] }),
    ])
    results.push(await freshNames(uid))
    await closeClients()
  }
  for (const r of results) expect(r).toEqual(['S1', 'S1 (copy 2)', 'S1 (copy)', 'S2'])
})

it('F3: the copy can be read the moment the create is called, before the order read returns (a tile\'s stats load)', async () => {
  const uid = uniqueId('u')
  const d = createFirestoreDriver(uid, client(uid))
  const s1 = newProject(uniqueId('a'), 'S1')
  await d.createProject(s1)
  const clone = cloneOf(s1, 'S1 (copy)', uid)
  const created = d.createProject(clone, { after: s1.id, shownIds: [s1.id] })
  const read = await outcome(d.loadProject(clone.id).then((p) => { if (p?.name !== 'S1 (copy)') throw new Error(`read ${p?.name}`) }))
  await created
  expect(read).toBe('resolved')
})

it('O20: an edit inside the 200 ms save debounce reaches the copy when the open project is copied from memory', async () => {
  const uid = uniqueId('u')
  const d = createFirestoreDriver(uid, client(uid))
  const open = newProject(uniqueId('a'), 'Open')
  await d.createProject(open)
  const edited = { ...open, snapshots: [{ date: '2026-07-01', counts: { backlog: 9, dev: 0, done: 0 } }] }
  void d.saveProject(edited) // debounced: not on the server yet
  const source = (await cloneSource(edited, open.id, d))!
  const clone = cloneOf(source, 'Open (copy)', uid)
  await d.createProject(clone, { after: open.id, shownIds: [open.id] })
  const data = (await getDoc(doc(client(uid), PROJECTS_COL, clone.id))).data()!
  expect(data.snapshots).toEqual(edited.snapshots)
  // Control: the stored copy, read inside the same window, lacks the edit.
  const again = { ...open, snapshots: [{ date: '2026-07-02', counts: { backlog: 1, dev: 0, done: 0 } }] }
  void d.saveProject(again)
  expect((await cloneSource(null, open.id, d))!.snapshots).not.toEqual(again.snapshots)
})

it('a refused create rejects, and neither the copy nor an order is written', async () => {
  const [uidA, uidB] = [uniqueId('a'), uniqueId('b')]
  const s1 = newProject(uniqueId('s'), 'S1')
  await createFirestoreDriver(uidB, client(uidB)).createProject(s1)
  // A driver for A on B's client: the create rule refuses owner ≠ auth.uid (Opus-R1b-1 -06).
  const clone = cloneOf(s1, 'S1 (copy)', uidA)
  const result = await outcome(createFirestoreDriver(uidA, client(uidB)).createProject(clone, { after: s1.id, shownIds: [s1.id] }))
  expect(result).toBe('rejected:permission-denied')
  // A's list holds no copy (a missing document's get is denied, so the list is the proof), and no order moved.
  expect(await createFirestoreDriver(uidA, client(uidA)).loadProjectList()).toEqual([])
  expect(await storedOrder(uidA)).toEqual([])
  expect(await storedOrder(uidB)).toEqual([s1.id])
})
