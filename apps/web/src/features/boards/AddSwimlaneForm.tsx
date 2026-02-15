import { useState } from 'react';
import { useBoardStore } from '../../stores/boardStore.js';
import * as swimlanesApi from '../../api/swimlanes.api.js';
import { Button } from '../../components/ui/Button.js';

interface AddSwimlaneFormProps {
  boardId: string;
}

export function AddSwimlaneForm({ boardId }: AddSwimlaneFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const addSwimlane = useBoardStore((s) => s.addSwimlane);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const swimlane = await swimlanesApi.createSwimlane(boardId, { name: name.trim() });
      addSwimlane(swimlane);
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
        className="w-full h-10 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center text-sm transition-colors"
      >
        + Swimlane hinzufuegen
      </button>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') setIsOpen(false);
        }}
        placeholder="Swimlane-Name..."
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={submitting || !name.trim()}>
          Hinzufuegen
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
