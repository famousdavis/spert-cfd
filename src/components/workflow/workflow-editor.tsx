'use client';

import { useState } from 'react';
import { useActiveProject } from '@/contexts/active-project-context';
import { useWorkflowEditor } from '@/lib/use-workflow-editor';
import { StateRow } from './state-row';
import { Pencil, Plus, Eye } from 'lucide-react';

export function WorkflowEditor() {
  const { workflow, snapshots, updateWorkflow } = useActiveProject();
  const editor = useWorkflowEditor(workflow, snapshots, updateWorkflow);
  const [isEditing, setIsEditing] = useState(false);

  const stateHasData = (stateId: string) =>
    snapshots.some((s) => (s.counts[stateId] ?? 0) > 0);

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Workflow
        </h2>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="rounded p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500"
          title={isEditing ? 'View mode' : 'Edit workflow'}
          aria-label={isEditing ? 'Switch to view mode' : 'Edit workflow'}
        >
          {isEditing ? <Eye size={14} /> : <Pencil size={14} />}
        </button>
      </div>

      {isEditing ? (
        <>
          {/* Edit mode */}
          <div className="space-y-1.5">
            {editor.states.map((state, i) => (
              <StateRow
                key={state.id}
                state={state}
                isFirst={i === 0}
                isLast={i === editor.states.length - 1}
                canDelete={editor.states.length > 1}
                deleteWarning={stateHasData(state.id)}
                onRename={(name) => editor.renameState(state.id, name)}
                onSetColor={(color) => editor.setColor(state.id, color)}
                onSetCategory={(cat) => editor.setCategory(state.id, cat)}
                onSetWipLimit={(limit) => editor.setWipLimit(state.id, limit)}
                onMoveUp={() => editor.moveUp(state.id)}
                onMoveDown={() => editor.moveDown(state.id)}
                onDelete={() => editor.deleteState(state.id).confirm()}
              />
            ))}
          </div>

          <button
            onClick={() => editor.addState()}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-dashed border-gray-300 py-1.5 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            <Plus size={14} />
            Add State
          </button>
        </>
      ) : (
        /* View mode */
        <ul className="space-y-1">
          {editor.states.map((state) => (
            <li
              key={state.id}
              className="flex items-center gap-2 rounded px-2 py-1 text-sm"
            >
              <span
                className="inline-block h-3 w-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: state.color }}
              />
              <span className="truncate">{state.name}</span>
              {state.wipLimit !== undefined && (
                <span className="ml-auto text-xs text-gray-400">
                  WIP: {state.wipLimit}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
