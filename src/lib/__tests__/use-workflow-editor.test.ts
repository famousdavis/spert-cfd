// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { normalizeOrders, nextColor } from '../use-workflow-editor';
import type { WorkflowState } from '@/types';
import { PRESET_COLORS } from '../colors';

// ── Helper to make test states ───────────────────────────

function makeState(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    id: 'state-1',
    name: 'Test',
    color: '#3b82f6',
    category: 'active',
    order: 0,
    ...overrides,
  };
}

// ── normalizeOrders ──────────────────────────────────────

describe('normalizeOrders', () => {
  it('re-assigns contiguous orders from 0', () => {
    const states = [
      makeState({ id: 'a', order: 5 }),
      makeState({ id: 'b', order: 10 }),
      makeState({ id: 'c', order: 20 }),
    ];
    const result = normalizeOrders(states);
    expect(result.map((s) => s.order)).toEqual([0, 1, 2]);
    expect(result.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('preserves relative order', () => {
    const states = [
      makeState({ id: 'c', order: 3 }),
      makeState({ id: 'a', order: 1 }),
      makeState({ id: 'b', order: 2 }),
    ];
    const result = normalizeOrders(states);
    expect(result.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(result.map((s) => s.order)).toEqual([0, 1, 2]);
  });

  it('is idempotent on already contiguous orders', () => {
    const states = [
      makeState({ id: 'a', order: 0 }),
      makeState({ id: 'b', order: 1 }),
    ];
    const result = normalizeOrders(states);
    expect(result.map((s) => s.order)).toEqual([0, 1]);
  });

  it('handles empty array', () => {
    expect(normalizeOrders([])).toEqual([]);
  });

  it('handles single state', () => {
    const result = normalizeOrders([makeState({ id: 'a', order: 5 })]);
    expect(result[0].order).toBe(0);
  });
});

// ── nextColor ────────────────────────────────────────────

describe('nextColor', () => {
  it('returns first preset color when no states exist', () => {
    expect(nextColor([])).toBe(PRESET_COLORS[0]);
  });

  it('returns first unused preset color', () => {
    const states = [makeState({ color: PRESET_COLORS[0] })];
    expect(nextColor(states)).toBe(PRESET_COLORS[1]);
  });

  it('skips used colors', () => {
    const states = [
      makeState({ id: 'a', color: PRESET_COLORS[0] }),
      makeState({ id: 'b', color: PRESET_COLORS[1] }),
      makeState({ id: 'c', color: PRESET_COLORS[2] }),
    ];
    expect(nextColor(states)).toBe(PRESET_COLORS[3]);
  });

  it('wraps around when all presets used', () => {
    const states = PRESET_COLORS.map((color, i) =>
      makeState({ id: `s${i}`, color }),
    );
    // All 12 presets used, should cycle using modulo
    const result = nextColor(states);
    expect(PRESET_COLORS).toContain(result);
  });
});
