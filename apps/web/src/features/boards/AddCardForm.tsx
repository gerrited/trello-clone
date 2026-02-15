import { useState } from 'react';
import { useBoardStore } from '../../stores/boardStore.js';
import * as cardsApi from '../../api/cards.api.js';
import { Button } from '../../components/ui/Button.js';

interface AddCardFormProps {
  boardId: string;
  columnId: string;
}

export function AddCardForm({ boardId, columnId }: AddCardFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const addCard = useBoardStore((s) => s.addCard);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const card = await cardsApi.createCard(boardId, { title: title.trim(), columnId });
      addCard({
        id: card.id,
        columnId: card.columnId,
        swimlaneId: card.swimlaneId,
        parentCardId: card.parentCardId,
        cardType: card.cardType,
        title: card.title,
        position: card.position,
        assignees: [],
        commentCount: 0,
        subtaskCount: 0,
        subtaskDoneCount: 0,
      });
      setTitle('');
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
        className="w-full text-left text-sm text-gray-500 hover:text-gray-700 py-1 px-2 rounded hover:bg-gray-200 transition-colors"
      >
        + Karte hinzufügen
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
          if (e.key === 'Escape') setIsOpen(false);
        }}
        placeholder="Kartentitel eingeben..."
        className="w-full rounded border border-gray-300 p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={2}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={submitting || !title.trim()}>
          Hinzufügen
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
