'use client';

import type { WorkflowState } from '@/types';

interface ChartControlsProps {
  workflow: WorkflowState[];
  hiddenStates: Set<string>;
  onToggle: (stateId: string) => void;
}

export function ChartControls({
  workflow,
  hiddenStates,
  onToggle,
}: ChartControlsProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {workflow.map((state) => {
        const isHidden = hiddenStates.has(state.id);
        return (
          <button
            key={state.id}
            onClick={() => onToggle(state.id)}
            className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-xs transition-opacity ${
              isHidden ? 'opacity-40' : ''
            }`}
            title={isHidden ? `Show ${state.name}` : `Hide ${state.name}`}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: state.color }}
            />
            {state.name}
          </button>
        );
      })}
    </div>
  );
}
