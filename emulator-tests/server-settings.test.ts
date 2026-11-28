// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// `serverSettings` (helpers.ts) is how these tests observe the settings
// document as the server holds it. Since CI run 46069457476 it reads the
// emulator's REST API and decodes the result itself, instead of asking an SDK
// client. These tests pin that the decoded result is exactly what the SDK's
// own `data()` returns for every shape the document holds (an empty map and
// an empty list included), and that a missing document is null.
//
// They do NOT test the race that run caught; nothing here can make it happen
// on demand. That evidence is the CI loop on the PR that made this change.
import { it, expect, afterEach } from 'vitest'
import { doc, getDocFromServer, setDoc } from 'firebase/firestore'
import { SETTINGS_COL } from '@/lib/firestore-helpers'
import { client, closeClients, serverSettings, uniqueId } from './helpers'

afterEach(closeClients)

it('serverSettings is null for a user with no settings document', async () => {
  const uid = uniqueId('u')
  expect((await getDocFromServer(doc(client(uid), SETTINGS_COL, uid))).exists()).toBe(false) // the control
  expect(await serverSettings(uid)).toBeNull()
})

it.each([
  ['an order, and colour and archive entries, one of them emptied', {
    projectOrder: ['b', 'a', 'c'],
    projectPrefs: { a: { color: 'teal', archived: true }, b: { archived: true }, c: {} },
  }],
  ['an empty order and no entries', { projectOrder: [], projectPrefs: {} }],
])('serverSettings reads back %s exactly as the SDK does', async (_shape, written) => {
  const uid = uniqueId('u')
  await setDoc(doc(client(uid), SETTINGS_COL, uid), written) // as the user, through the deployed rules
  // The control: another device's read, made after the write was acknowledged,
  // so no read races the commit.
  const sdk = (await getDocFromServer(doc(client(uid), SETTINGS_COL, uid))).data()
  expect(sdk).toStrictEqual(written)
  expect(await serverSettings(uid)).toStrictEqual(sdk)
})
