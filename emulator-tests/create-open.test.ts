// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// A project read straight after its create (QC26 Q01). Until the create lands
// the server holds no document, and `allow get: if isCfdMember(resource.data)`
// denies any get or listen on it. Before v0.15.19 the app read a new project
// at once, both reads were denied, the denied listener was taken for a
// revoked share, and the new project could not be opened.
import { describe, it, expect, afterEach } from 'vitest'
import { disableNetwork, enableNetwork } from 'firebase/firestore'
import { createFirestoreDriver } from '@/lib/firestore-driver'
import type { Project } from '@/types'
import { client, closeClients, newProject, outcome, sleep, track, uniqueId, waitFor, watchRevocations } from './helpers'

let watch: ReturnType<typeof watchRevocations>
afterEach(async () => {
  await closeClients() // listeners first, so none can report into the next test
  watch?.stop()
})

describe('a project read straight after its create', () => {
  it('opens: the same-tick load and listen see the new project, and nothing reads as revoked', async () => {
    watch = watchRevocations()
    const uid = uniqueId('u')
    const driver = createFirestoreDriver(uid, client(uid))
    const p = newProject(uniqueId('p'), 'Created')

    // What the app does: createProject is not awaited, and the new id becomes
    // the active project, whose load and listen run in the same commit.
    const created = outcome(driver.createProject(p))
    const loaded = driver.loadProject(p.id).then((x) => x?.name, outcome)
    let delivered: string | null = null
    const unsubscribe = track(driver.onProjectChange(p.id, (x) => { delivered = x?.name ?? null }))

    expect(await created).toBe('resolved')
    expect(await loaded).toBe('Created')
    expect(await waitFor(() => delivered !== null)).toBe(true)
    await sleep(300) // room for a late denial to arrive
    unsubscribe()
    expect(delivered).toBe('Created')
    expect(watch.revoked).toEqual([])
    expect(watch.listenerErrors()).toBe(0)
  })

  it('opens offline: the cache serves it, and the deferred listener delivers once the create lands', async () => {
    // No edit queued behind the create, on purpose: with one, the listener's
    // first snapshot carries pending writes and is skipped, and the write's
    // acknowledgement is metadata-only, so nothing is delivered until another
    // change arrives (measured in Q01). Same mechanism as sdk-facts.test.ts.
    watch = watchRevocations()
    const uid = uniqueId('u')
    const db = client(uid)
    const driver = createFirestoreDriver(uid, db)
    const p = newProject(uniqueId('p'), 'Created offline')

    await disableNetwork(db)
    const created = outcome(driver.createProject(p))
    expect((await driver.loadProject(p.id))?.name).toBe('Created offline')
    const delivered: Array<Project | null> = []
    const unsubscribe = track(driver.onProjectChange(p.id, (x) => { delivered.push(x) }))
    await sleep(300)
    expect(delivered).toEqual([]) // still offline: no listen has been opened
    await enableNetwork(db)

    expect(await created).toBe('resolved')
    expect(await waitFor(() => delivered.length > 0)).toBe(true)
    await sleep(300)
    unsubscribe()
    expect([...new Set(delivered.map((x) => x?.name))]).toEqual(['Created offline'])
    expect(watch.revoked).toEqual([])
    expect(watch.listenerErrors()).toBe(0)
  })

  it('a create the server rejects is reported, and no listener is ever opened on it', async () => {
    // The driver writes owner = its uid; the emulator signs this client in as
    // someone else, so `request.resource.data.owner == request.auth.uid` fails.
    watch = watchRevocations()
    const signedIn = uniqueId('u')
    const driver = createFirestoreDriver(uniqueId('other'), client(signedIn))
    const p = newProject(uniqueId('p'), 'Refused')

    const created = outcome(driver.createProject(p))
    // While it is in flight the cache holds the pending write.
    expect((await driver.loadProject(p.id))?.name).toBe('Refused')
    let deliveries = 0
    const unsubscribe = track(driver.onProjectChange(p.id, () => { deliveries++ }))

    expect(await created).toBe('rejected:permission-denied')
    await sleep(500)
    unsubscribe()
    expect(deliveries).toBe(0)
    expect(watch.revoked).toEqual([])
    expect(watch.listenerErrors()).toBe(0)
    expect(await outcome(driver.loadProject(p.id))).toBe('rejected:permission-denied')
  })
})
