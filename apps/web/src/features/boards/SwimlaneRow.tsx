import { useState } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import type { Swimlane } from '@trello-clone/shared';
import { useBoardStore } from '../../stores/boardStore.js';
import * as swimlanesApi from '../../api/swimlanes.api.js';

interface SwimlaneRowHeaderProps {
  swimlane: Swimlane;
  boardId: string;
}

export function SwimlaneRowHeader({ swimlane, boardId }: SwimlaneRowHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(swimlane.name);
  const updateSwimlaneInStore = useBoardStore((s) => s.updateSwimlane);
  const removeSwimlaneFromStore = useBoardStore((s) => s.removeSwimlane);

  const handleSave = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === swimlane.name) {
      setIsEditing(false);
      setEditName(swimlane.name);
      return;
    }
    try {
      const updated = await swimlanesApi.updateSwimlane(boardId, swimlane.id, { name: trimmed });
      updateSwimlaneInStore(swimlane.id, { name: updated.name });
      setIsEditing(false);
    } catch {
      setEditName(swimlane.name);
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    try {
      await swimlanesApi.deleteSwimlane(boardId, swimlane.id);
      removeSwimlaneFromStore(swimlane.id);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Fehler beim Löschen der Swimlane');
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 py-2 px-3 bg-gray-50 rounded">
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') {
              setEditName(swimlane.name);
              setIsEditing(false);
            }
          }}
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSave}
          className="p-1 text-green-600 hover:bg-green-50 rounded"
          title="Speichern"
        >
          <Check size={14} />
        </button>
        <button
          onClick={() => { setEditName(swimlane.name); setIsEditing(false); }}
          className="p-1 text-gray-500 hover:bg-gray-100 rounded"
          title="Abbrechen"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-2 px-3 group">
      <h4 className="font-semibold text-sm text-gray-700 truncate">{swimlane.name}</h4>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => { setEditName(swimlane.name); setIsEditing(true); }}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          title="Umbenennen"
        >
          <Pencil size={12} />
        </button>
        {!swimlane.isDefault && (
          <button
            onClick={handleDelete}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Löschen"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
