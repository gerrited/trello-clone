import { useState } from 'react';
import { useBoardStore } from '../../stores/boardStore.js';
import * as columnsApi from '../../api/columns.api.js';
import { Button } from '../../components/ui/Button.js';

interface AddColumnFormProps {
  boardId: string;
}

export function AddColumnForm({ boardId }: AddColumnFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const addColumn = useBoardStore((s) => s.addColumn);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const column = await columnsApi.createColumn(boardId, { name: name.trim() });
      addColumn(column);
      setName('');
      setIsOpen(false);
    } catch {
      // Keep form open on error so user can retry
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex-shrink-0 w-full sm:w-72 h-12 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center text-sm transition-colors"
      >
        + Spalte hinzufügen
      </button>
    );
  }

  return (
    <div className="flex-shrink-0 w-full sm:w-72 bg-gray-100 rounded-lg p-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') setIsOpen(false);
        }}
        placeholder="Spaltenname..."
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex gap-2 mt-2">
        <Button size="sm" onClick={handleSubmit} disabled={submitting || !name.trim()}>
          Hinzufügen
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
