// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { handleModelsChanged } from '../use-invitation-landing';
import { SESSION_KEY } from '@/lib/invite-capture';

function makeDeps(initialToken: string | null) {
  let token = initialToken;
  const setState = vi.fn();
  const getItem = vi.fn((key: string) => (key === SESSION_KEY ? token : null));
  const removeItem = vi.fn((key: string) => {
    if (key === SESSION_KEY) token = null;
  });
  return {
    setState,
    sessionStorage: { getItem, removeItem },
  };
}

function makeEvent(claimed: Array<{ appId: string; modelId: string; modelName: string }>) {
  // The pure handler reads only `evt.detail.claimed`, so a plain object
  // satisfies the contract without needing a real CustomEvent.
  return { detail: { claimed } } as unknown as Event;
}

describe('handleModelsChanged (Lesson 27 SESSION_KEY gate)', () => {
  it('does NOT transition when SESSION_KEY is absent (normal sign-in path)', () => {
    const deps = makeDeps(null);
    const evt = makeEvent([
      { appId: 'spertcfd', modelId: 'm1', modelName: 'Project One' },
    ]);

    handleModelsChanged(evt, deps);

    expect(deps.setState).not.toHaveBeenCalled();
    expect(deps.sessionStorage.removeItem).not.toHaveBeenCalled();
  });

  it('transitions to claimed and clears SESSION_KEY when token is present', () => {
    const deps = makeDeps('token-abc');
    const evt = makeEvent([
      { appId: 'spertcfd', modelId: 'm1', modelName: 'Project One' },
      { appId: 'spertcfd', modelId: 'm2', modelName: 'Project Two' },
    ]);

    handleModelsChanged(evt, deps);

    expect(deps.sessionStorage.removeItem).toHaveBeenCalledWith(SESSION_KEY);
    expect(deps.setState).toHaveBeenCalledTimes(1);
    expect(deps.setState).toHaveBeenCalledWith({
      kind: 'claimed',
      modelNames: ['Project One', 'Project Two'],
    });
  });

  it('does NOT transition when claimed payload is empty even with SESSION_KEY present', () => {
    const deps = makeDeps('token-abc');
    const evt = makeEvent([]);

    handleModelsChanged(evt, deps);

    expect(deps.setState).not.toHaveBeenCalled();
    // SESSION_KEY removal is also skipped — the gate cleared the read,
    // but the empty-payload short-circuit comes before removeItem.
    expect(deps.sessionStorage.removeItem).not.toHaveBeenCalled();
  });

  it('filters empty modelName entries from the claimed list', () => {
    const deps = makeDeps('token-abc');
    const evt = makeEvent([
      { appId: 'spertcfd', modelId: 'm1', modelName: 'Real Project' },
      { appId: 'spertcfd', modelId: 'm2', modelName: '' },
    ]);

    handleModelsChanged(evt, deps);

    expect(deps.setState).toHaveBeenCalledWith({
      kind: 'claimed',
      modelNames: ['Real Project'],
    });
  });

  it('survives sessionStorage.removeItem throwing (private mode / quota)', () => {
    const setState = vi.fn();
    const getItem = vi.fn(() => 'token-abc');
    const removeItem = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });
    const evt = makeEvent([
      { appId: 'spertcfd', modelId: 'm1', modelName: 'Project One' },
    ]);

    expect(() =>
      handleModelsChanged(evt, { setState, sessionStorage: { getItem, removeItem } }),
    ).not.toThrow();
    expect(setState).toHaveBeenCalledWith({
      kind: 'claimed',
      modelNames: ['Project One'],
    });
  });
});
