// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// A change made elsewhere reaches the project open on this device. The real
// ProjectListProvider and ActiveProjectProvider run over the real cloud
// driver; only useStorage is replaced, to hand them that driver (the real
// StorageProvider needs a signed-in Firebase Auth user, and no agent signs in).
// The applying of a remote snapshot lives in ActiveProjectProvider, so a test
// of the driver's listener alone could not see it break.
import { it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import type { StorageDriver } from '@/lib/storage-driver'
import { client, closeClients, newProject, sleep, uniqueId } from './helpers'

let driver: StorageDriver
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({ driver, mode: 'cloud' }),
}))

import { createFirestoreDriver } from '@/lib/firestore-driver'
import { LS_ACTIVE_PROJECT } from '@/lib/constants'
import { ProjectListProvider, useProjectList } from '@/contexts/project-list-context'
import { ActiveProjectProvider, useActiveProject } from '@/contexts/active-project-context'

afterEach(async () => {
  localStorage.clear()
  await closeClients()
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ProjectListProvider>
    <ActiveProjectProvider>{children}</ActiveProjectProvider>
  </ProjectListProvider>
)

/** Lets real network replies and the renders they cause take turns. */
async function settleUntil(pred: () => boolean, ms = 10_000) {
  const until = Date.now() + ms
  while (!pred() && Date.now() < until) {
    await act(async () => { await sleep(50) })
  }
  return pred()
}

it('a rename saved on another device shows in the project open here', async () => {
  const uid = uniqueId('u')
  driver = createFirestoreDriver(uid, client(uid))
  const p = newProject(uniqueId('p'), 'Before')
  await driver.createProject(p)
  localStorage.setItem(LS_ACTIVE_PROJECT, p.id)

  const { result, unmount } = renderHook(
    () => ({ list: useProjectList(), active: useActiveProject() }),
    { wrapper },
  )
  expect(await settleUntil(() => result.current.active.project?.name === 'Before')).toBe(true)
  await act(async () => { await sleep(500) }) // the listener is attached and has delivered once

  // The same user on a second device: its own client, its own driver.
  const otherDevice = createFirestoreDriver(uid, client(uid))
  await otherDevice.saveProject({ ...p, name: 'Renamed elsewhere' })

  expect(await settleUntil(() => result.current.active.project?.name === 'Renamed elsewhere')).toBe(true)
  unmount()
})
