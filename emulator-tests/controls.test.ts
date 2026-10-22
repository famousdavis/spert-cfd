// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The tier's own controls. An emulator given no rules allows everything and
// every other test here goes green, so these prove first that the pinned
// rules are the ones in force, and that the counters the other files read as
// zero can count.
import { describe, it, expect, inject, afterEach } from 'vitest'
import { createFirestoreDriver } from '@/lib/firestore-driver'
import { client, closeClients, newProject, outcome, track, uniqueId, waitFor, watchRevocations } from './helpers'
import pin from './rules-pin.json'

afterEach(closeClients)

describe('the emulator enforces the pinned, deployed rules', () => {
  it('the rules loaded are the pinned ones (repo, commit, md5)', () => {
    const loaded = inject('rulesLoaded')
    expect(loaded).toEqual(pin)
  })

  it('denied control: reading a project that was never created is refused', async () => {
    // allow get: if isAuth() && isCfdMember(resource.data) — no resource, no member.
    const uid = uniqueId('u')
    const driver = createFirestoreDriver(uid, client(uid))
    expect(await outcome(driver.loadProject(uniqueId('never')))).toBe('rejected:permission-denied')
  })

  it('allowed control: the owner reads back a project once its create has landed', async () => {
    const uid = uniqueId('u')
    const driver = createFirestoreDriver(uid, client(uid))
    const p = newProject(uniqueId('p'), 'Allowed control')
    await driver.createProject(p)
    expect((await driver.loadProject(p.id))?.name).toBe('Allowed control')
  })

  it('positive control: a denied listen is counted as revoked access and a listener error', async () => {
    // What the other files assert to be zero must be able to be non-zero.
    const watch = watchRevocations()
    try {
      const uid = uniqueId('u')
      const driver = createFirestoreDriver(uid, client(uid))
      const id = uniqueId('never')
      const unsubscribe = track(driver.onProjectChange(id, () => {}))
      expect(await waitFor(() => watch.revoked.includes(id))).toBe(true)
      unsubscribe()
      expect(watch.revoked).toEqual([id])
      expect(watch.listenerErrors()).toBe(1)
    } finally {
      watch.stop()
    }
  })
})
