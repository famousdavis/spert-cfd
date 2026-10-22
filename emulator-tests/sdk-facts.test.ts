// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// What the real SDK does, where the unit tier's mock says otherwise.
//
// src/lib/__tests__/firestore-driver.test.ts mocks onSnapshot to fire whatever
// metadata a test hands it, so in that suite a client's own write can come
// back to its own listener. The real SDK never delivers it: the local write's
// snapshot carries hasPendingWrites (the driver's echo filter skips it), and
// the server's acknowledgement changes metadata only, which onSnapshot does
// not report without includeMetadataChanges. Code that relies on its own write
// coming back (a rename applied through the listener, say) never sees it.
// This file pins the fact itself, so the mock can be checked against it.
import { it, expect, afterEach } from 'vitest'
import { createFirestoreDriver } from '@/lib/firestore-driver'
import { client, closeClients, newProject, sleep, track, uniqueId, waitFor } from './helpers'

afterEach(closeClients)

it("a device's own save never reaches its own listener; another device's save does", async () => {
  const uid = uniqueId('u')
  const here = createFirestoreDriver(uid, client(uid))
  const p = newProject(uniqueId('p'), 'Original')
  await here.createProject(p)

  const delivered: string[] = []
  const unsubscribe = track(here.onProjectChange(p.id, (x) => { if (x) delivered.push(x.name) }))
  expect(await waitFor(() => delivered.length === 1)).toBe(true) // the listener is live
  expect(delivered).toEqual(['Original'])

  await here.saveProject({ ...p, name: 'Saved here' })
  await sleep(1000)
  const elsewhere = createFirestoreDriver(uid, client(uid))
  expect((await elsewhere.loadProject(p.id))?.name).toBe('Saved here') // it did land
  expect(delivered).toEqual(['Original']) // and was not delivered back

  // Positive control: the same listener does hear another device's save.
  await elsewhere.saveProject({ ...p, name: 'Saved elsewhere' })
  expect(await waitFor(() => delivered.length === 2)).toBe(true)
  unsubscribe()
  expect(delivered).toEqual(['Original', 'Saved elsewhere'])
})
