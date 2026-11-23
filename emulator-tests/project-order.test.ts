// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The card order a user sets is the order they get back. It lives in
// spertcfd_settings/{uid}.projectOrder. The rules confine that document to
// keys().hasOnly(['projectOrder', 'projectPrefs']) (projectPrefs since landing
// v2.14.3, ahead of the release that writes it); createProject appends with
// arrayUnion and reorderProjects writes the whole array.
import { it, expect, afterEach } from 'vitest'
import { createFirestoreDriver } from '@/lib/firestore-driver'
import { client, closeClients, newProject, uniqueId } from './helpers'

afterEach(closeClients)

it('the stored project order is applied: creation order first, then the reorder', async () => {
  const uid = uniqueId('u')
  const driver = createFirestoreDriver(uid, client(uid))
  const [a, b, c] = ['A', 'B', 'C'].map((name) => newProject(uniqueId('p'), name))
  for (const p of [a, b, c]) await driver.createProject(p)

  const names = async () => (await driver.loadProjectList()).map((p) => p.name)
  expect(await names()).toEqual(['A', 'B', 'C'])

  await driver.reorderProjects([c.id, a.id, b.id])
  expect(await names()).toEqual(['C', 'A', 'B'])
})
