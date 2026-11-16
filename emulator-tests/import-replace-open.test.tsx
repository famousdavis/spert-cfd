// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Replacing the project open on this device by import, then editing it, must
// keep the import.
//
// applyImportMerge (ProjectListContext) saves the imported project;
// ActiveProjectContext saves its own in-memory copy, workflow and snapshots
// included, on every edit. In local mode a replace of the open project makes
// that copy reload from storage. In cloud mode the copy was left to the doc
// listener, which never hears this device's own save (sdk-facts.test.ts pins
// that), so before v0.17.7 the copy kept the pre-import data and the next
// edit wrote it back over the import.
//
// The real ProjectListProvider and ActiveProjectProvider over the real cloud
// driver, as in remote-change.test.tsx; only useStorage is replaced.
import { it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import type { StorageDriver } from '@/lib/storage-driver'
import type { Project } from '@/types'
import { client, closeClients, newProject, sleep, uniqueId } from './helpers'

let driver: StorageDriver
vi.mock('@/contexts/storage-context', () => ({
  useStorage: () => ({ driver, mode: 'cloud' }),
}))

import { createFirestoreDriver } from '@/lib/firestore-driver'
import { LS_ACTIVE_PROJECT } from '@/lib/constants'
import { mergeSnapshots } from '@/lib/dates'
import { runDataReset } from '@/lib/app-data-reset-registry'
import { detectImportConflicts, type ImportMergeOutcome } from '@/lib/import-utils'
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

/** Reads the stored project until `pred` holds or `ms` passes; returns the last read. */
async function storedUntil(read: () => Promise<Project | null>, pred: (p: Project) => boolean, ms = 10_000) {
  const until = Date.now() + ms
  let last = await read()
  while (!(last && pred(last)) && Date.now() < until) {
    await act(async () => { await sleep(100) })
    last = await read()
  }
  return last
}

const dates = (p: Project | null | undefined) => p?.snapshots.map((s) => s.date)

/** The project open here: three states, one snapshot. */
function opened(id: string): Project {
  return {
    ...newProject(id, 'Before'),
    snapshots: [{ date: '2026-01-05', counts: { backlog: 4, dev: 1, done: 0 } }],
  }
}

/** The same project as a file brings it back: changed elsewhere, then exported. */
function imported(p: Project): Project {
  return {
    ...p,
    name: 'Imported',
    workflow: [
      ...p.workflow.slice(0, 2),
      { id: 'qa', name: 'QA', color: '#a855f7', category: 'active', order: 2 },
      { ...p.workflow[2], order: 3 },
    ],
    snapshots: [
      { date: '2026-03-02', counts: { backlog: 9, dev: 2, qa: 1, done: 3 } },
      { date: '2026-03-09', counts: { backlog: 7, dev: 3, qa: 2, done: 4 } },
    ],
  }
}

type Hook = { current: { list: ReturnType<typeof useProjectList>; active: ReturnType<typeof useActiveProject> } }

/** Confirms an import of `incoming` with Replace on its conflict, as the preview does. */
async function importReplacing(result: Hook, incoming: Project) {
  const originalConflicts = detectImportConflicts([incoming], result.current.list.projects)
  expect(originalConflicts.map((c) => c.type)).toEqual(['id']) // control: it conflicts by id
  let outcome: ImportMergeOutcome | undefined
  await act(async () => {
    outcome = await result.current.list.applyImportMerge({
      incoming: [incoming],
      decisions: new Map([[incoming.id, 'replace']]),
      originalConflicts,
    })
  })
  expect(outcome).toMatchObject({ ok: true, replaced: 1 })
}

const ADDED_DATE = '2026-03-16'

/** The edits ActiveProjectContext saves, as the UI makes them. */
const EDITS = [
  {
    what: 'the grid sort toggle (updateSettings)',
    run: (r: Hook) => r.current.active.updateSettings({ gridSortNewestFirst: false }),
    landed: (s: Project) => s.settings.gridSortNewestFirst === false,
    // The edit carries no workflow or snapshots of its own: the stored
    // project must be the import exactly.
    expectedDates: ['2026-03-02', '2026-03-09'],
  },
  {
    what: 'Add Row (updateSnapshots)',
    run: (r: Hook) => {
      const { snapshots, updateSnapshots } = r.current.active
      updateSnapshots(mergeSnapshots(snapshots, [{ date: ADDED_DATE, counts: { backlog: 6, dev: 3, qa: 2, done: 6 } }]))
    },
    landed: (s: Project) => s.snapshots.some((x) => x.date === ADDED_DATE),
    expectedDates: ['2026-03-02', '2026-03-09', ADDED_DATE],
  },
  {
    what: 'a workflow edit (updateWorkflow)',
    run: (r: Hook) => {
      const { workflow, updateWorkflow } = r.current.active
      updateWorkflow(workflow.map((w) => (w.id === 'dev' ? { ...w, name: 'Building' } : w)))
    },
    landed: (s: Project) => s.workflow.some((w) => w.name === 'Building'),
    expectedDates: ['2026-03-02', '2026-03-09'],
  },
]

it.each(EDITS)('an import replacing the open project is shown, and kept when the next edit is $what', async (edit) => {
  const uid = uniqueId('u')
  driver = createFirestoreDriver(uid, client(uid))
  const p = opened(uniqueId('p'))
  await driver.createProject(p)
  localStorage.setItem(LS_ACTIVE_PROJECT, p.id)

  const { result, unmount } = renderHook(
    () => ({ list: useProjectList(), active: useActiveProject() }),
    { wrapper },
  )
  expect(await settleUntil(() => result.current.active.project?.name === 'Before')).toBe(true)
  await act(async () => { await sleep(500) }) // the listener is attached and has delivered once

  const file = imported(p)
  await importReplacing(result, file)

  // Control: the import lands. Read from a second device of the same user.
  const elsewhere = createFirestoreDriver(uid, client(uid))
  const read = () => elsewhere.loadProject(p.id)
  expect(dates(await storedUntil(read, (s) => s.workflow.length === 4))).toEqual(['2026-03-02', '2026-03-09'])

  // The view shows the import. v0.13.0 said it "catches up shortly after"
  // (about 500 ms and a round trip); 5 s is ten times that.
  const shown = await settleUntil(() => result.current.active.workflow.length === 4, 5_000)
  expect.soft(shown, 'the open project shows the import').toBe(true)
  expect.soft(dates(result.current.active.project)).toEqual(['2026-03-02', '2026-03-09'])

  act(() => edit.run(result))
  const stored = await storedUntil(read, edit.landed)
  expect(stored && edit.landed(stored), 'control: the edit saved').toBe(true)
  expect(stored?.name).toBe('Imported')
  expect(stored?.workflow.map((w) => w.id)).toEqual(['backlog', 'dev', 'qa', 'done'])
  expect(dates(stored)).toEqual(edit.expectedDates)
  unmount()
})

it('importing the same file again, after an edit, is shown and kept too', async () => {
  const uid = uniqueId('u')
  driver = createFirestoreDriver(uid, client(uid))
  const p = opened(uniqueId('p'))
  await driver.createProject(p)
  localStorage.setItem(LS_ACTIVE_PROJECT, p.id)

  const { result, unmount } = renderHook(
    () => ({ list: useProjectList(), active: useActiveProject() }),
    { wrapper },
  )
  expect(await settleUntil(() => result.current.active.project?.name === 'Before')).toBe(true)
  await act(async () => { await sleep(500) })

  const elsewhere = createFirestoreDriver(uid, client(uid))
  const read = () => elsewhere.loadProject(p.id)
  const file = imported(p) // one file, imported twice: the same parsed object
  await importReplacing(result, file)
  await storedUntil(read, (s) => s.workflow.length === 4)
  act(() => EDITS[0].run(result)) // the grid sort toggle: false
  expect((await storedUntil(read, EDITS[0].landed))?.settings.gridSortNewestFirst).toBe(false) // control

  await importReplacing(result, file) // brings the file's setting back: true
  expect(await settleUntil(() => result.current.active.settings.gridSortNewestFirst === true, 5_000)).toBe(true)
  act(() => EDITS[1].run(result)) // Add Row
  const stored = await storedUntil(read, EDITS[1].landed)
  expect(stored && EDITS[1].landed(stored)).toBe(true) // control: the edit saved
  expect(stored?.settings.gridSortNewestFirst).toBe(true)
  expect(dates(stored)).toEqual(EDITS[1].expectedDates)

  // Signing out forgets the import along with the rest of the prior session.
  expect(result.current.list.importedActiveProject?.id).toBe(p.id) // control
  act(() => runDataReset())
  expect(result.current.list.importedActiveProject).toBeNull()
  unmount()
})

it('an import replacing another project leaves the open one as it was', async () => {
  const uid = uniqueId('u')
  driver = createFirestoreDriver(uid, client(uid))
  const open = opened(uniqueId('p'))
  const other = { ...opened(uniqueId('q')), name: 'Other' }
  await driver.createProject(open)
  await driver.createProject(other)
  localStorage.setItem(LS_ACTIVE_PROJECT, open.id)

  const { result, unmount } = renderHook(
    () => ({ list: useProjectList(), active: useActiveProject() }),
    { wrapper },
  )
  expect(await settleUntil(() => result.current.active.project?.name === 'Before'
    && result.current.list.projects.length === 2)).toBe(true)
  await act(async () => { await sleep(500) })

  await importReplacing(result, { ...imported(other), name: 'Other, imported' })

  const elsewhere = createFirestoreDriver(uid, client(uid))
  const otherStored = await storedUntil(() => elsewhere.loadProject(other.id), (s) => s.workflow.length === 4)
  expect(otherStored?.name).toBe('Other, imported') // control: the import landed

  expect(result.current.active.project?.id).toBe(open.id)
  expect(result.current.active.workflow.length).toBe(3)
  act(() => EDITS[0].run(result))
  const stored = await storedUntil(() => elsewhere.loadProject(open.id), EDITS[0].landed)
  expect(stored && EDITS[0].landed(stored)).toBe(true) // control: the edit saved
  expect(stored?.name).toBe('Before')
  expect(stored?.workflow.length).toBe(3)
  expect(dates(stored)).toEqual(['2026-01-05'])
  // And the other project keeps its import.
  expect((await elsewhere.loadProject(other.id))?.workflow.length).toBe(4)
  unmount()
})
