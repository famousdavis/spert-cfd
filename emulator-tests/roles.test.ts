// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// What each role may do to a shared project, through the real driver. This
// documents the rules side only: the UI still offers viewers its edit
// controls and every member Delete (QC26 A-4, fixed elsewhere), and these
// tests say what the server does when one is used.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { doc, updateDoc } from 'firebase/firestore'
import { createFirestoreDriver } from '@/lib/firestore-driver'
import { PROJECTS_COL } from '@/lib/firestore-helpers'
import type { StorageDriver } from '@/lib/storage-driver'
import type { Project } from '@/types'
import { client, closeClients, newProject, outcome, uniqueId } from './helpers'

let owner: StorageDriver
let viewer: StorageDriver
let editor: StorageDriver
let shared: Project

beforeEach(async () => {
  const [ownerUid, viewerUid, editorUid] = [uniqueId('owner'), uniqueId('viewer'), uniqueId('editor')]
  const ownerDb = client(ownerUid)
  owner = createFirestoreDriver(ownerUid, ownerDb)
  viewer = createFirestoreDriver(viewerUid, client(viewerUid))
  editor = createFirestoreDriver(editorUid, client(editorUid))
  shared = newProject(uniqueId('p'), 'Shared')
  await owner.createProject(shared)
  // The owner shares it: the members map is the only thing a share changes.
  await updateDoc(doc(ownerDb, PROJECTS_COL, shared.id), {
    [`members.${viewerUid}`]: 'viewer',
    [`members.${editorUid}`]: 'editor',
  })
  expect((await viewer.loadProject(shared.id))?.name).toBe('Shared') // both can read it
  expect((await editor.loadProject(shared.id))?.name).toBe('Shared')
})

afterEach(closeClients)

describe('a shared project, by role', () => {
  it('a viewer cannot save an edit', async () => {
    const edited = { ...shared, snapshots: [{ date: '2026-01-05', counts: { backlog: 3 } }] }
    expect(await outcome(viewer.saveProject(edited))).toBe('rejected:permission-denied')
    expect((await owner.loadProject(shared.id))?.snapshots).toEqual([])
  })

  it('a viewer cannot rename it', async () => {
    expect(await outcome(viewer.saveProject({ ...shared, name: 'Viewer rename' }))).toBe('rejected:permission-denied')
    expect((await owner.loadProject(shared.id))?.name).toBe('Shared')
  })

  it('a viewer cannot delete it', async () => {
    expect(await outcome(viewer.deleteProject(shared.id))).toBe('rejected:permission-denied')
    expect((await owner.loadProject(shared.id))?.name).toBe('Shared')
  })

  it('an editor can save an edit', async () => {
    expect(await outcome(editor.saveProject({ ...shared, name: 'Editor rename' }))).toBe('resolved')
    expect((await owner.loadProject(shared.id))?.name).toBe('Editor rename')
  })

  it('an editor cannot delete it: only the owner can', async () => {
    expect(await outcome(editor.deleteProject(shared.id))).toBe('rejected:permission-denied')
    expect((await owner.loadProject(shared.id))?.name).toBe('Shared')
  })
})
