import { useCallback, useMemo } from 'react';
import { nanoid } from 'nanoid';
import type { WorkflowState, StateCategory, Snapshot } from '@/types';
import { PRESET_COLORS } from '@/lib/colors';
import { sortWorkflow } from '@/lib/dates';

// ── Pure helpers (exported for testing) ──────────────────

export function normalizeOrders(states: WorkflowState[]): WorkflowState[] {
  return [...states]
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ ...s, order: i }));
}

export function nextColor(states: WorkflowState[]): string {
  const used = new Set(states.map((s) => s.color));
  const available = PRESET_COLORS.find((c) => !used.has(c));
  return available ?? PRESET_COLORS[states.length % PRESET_COLORS.length];
}

// ── Hook ─────────────────────────────────────────────────

export function useWorkflowEditor(
  workflow: WorkflowState[],
  snapshots: Snapshot[],
  updateWorkflow: (states: WorkflowState[]) => void,
) {
  const states = useMemo(() => sortWorkflow(workflow), [workflow]);

  const addState = useCallback(() => {
    const maxOrder = workflow.reduce((max, s) => Math.max(max, s.order), -1);
    const newState: WorkflowState = {
      id: nanoid(8),
      name: 'New State',
      color: nextColor(workflow),
      category: 'active',
      order: maxOrder + 1,
    };
    updateWorkflow([...workflow, newState]);
    return newState.id;
  }, [workflow, updateWorkflow]);

  const deleteState = useCallback(
    (id: string) => {
      const hasData = snapshots.some((s) => (s.counts[id] ?? 0) > 0);
      return {
        hasData,
        confirm: () => {
          const remaining = workflow.filter((s) => s.id !== id);
          updateWorkflow(normalizeOrders(remaining));
        },
      };
    },
    [workflow, snapshots, updateWorkflow],
  );

  const renameState = useCallback(
    (id: string, name: string) => {
      if (!name.trim()) return;
      updateWorkflow(
        workflow.map((s) => (s.id === id ? { ...s, name: name.trim() } : s)),
      );
    },
    [workflow, updateWorkflow],
  );

  const setColor = useCallback(
    (id: string, color: string) => {
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
      updateWorkflow(
        workflow.map((s) => (s.id === id ? { ...s, color } : s)),
      );
    },
    [workflow, updateWorkflow],
  );

  const setCategory = useCallback(
    (id: string, category: StateCategory) => {
      updateWorkflow(
        workflow.map((s) => {
          if (s.id !== id) return s;
          const updated = { ...s, category };
          if (category !== 'active') {
            delete updated.wipLimit;
          }
          return updated;
        }),
      );
    },
    [workflow, updateWorkflow],
  );

  const setWipLimit = useCallback(
    (id: string, limit: number | undefined) => {
      updateWorkflow(
        workflow.map((s) => {
          if (s.id !== id || s.category !== 'active') return s;
          const cleaned = limit === undefined || limit <= 0 || isNaN(limit)
            ? undefined
            : limit;
          return { ...s, wipLimit: cleaned };
        }),
      );
    },
    [workflow, updateWorkflow],
  );

  const moveUp = useCallback(
    (id: string) => {
      const sorted = sortWorkflow(workflow);
      const idx = sorted.findIndex((s) => s.id === id);
      if (idx <= 0) return;
      const newStates = sorted.map((s, i) => {
        if (i === idx - 1) return { ...s, order: idx };
        if (i === idx) return { ...s, order: idx - 1 };
        return s;
      });
      updateWorkflow(newStates);
    },
    [workflow, updateWorkflow],
  );

  const moveDown = useCallback(
    (id: string) => {
      const sorted = sortWorkflow(workflow);
      const idx = sorted.findIndex((s) => s.id === id);
      if (idx < 0 || idx >= sorted.length - 1) return;
      const newStates = sorted.map((s, i) => {
        if (i === idx) return { ...s, order: idx + 1 };
        if (i === idx + 1) return { ...s, order: idx };
        return s;
      });
      updateWorkflow(newStates);
    },
    [workflow, updateWorkflow],
  );

  return {
    states,
    addState,
    deleteState,
    renameState,
    setColor,
    setCategory,
    setWipLimit,
    moveUp,
    moveDown,
  };
}
