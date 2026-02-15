import { useState } from 'react';
import { BookOpen, Bug, CheckSquare } from 'lucide-react';
import type { CardType } from '@trello-clone/shared';
import { useBoardStore } from '../../stores/boardStore.js';
import * as cardsApi from '../../api/cards.api.js';
import { Button } from '../../components/ui/Button.js';

const TYPE_PILL_COLORS: Record<string, { active: string; inactive: string }> = {
  task: { active: 'bg-blue-100 text-blue-700', inactive: 'text-gray-500 hover:bg-gray-100' },
  story: { active: 'bg-green-100 text-green-700', inactive: 'text-gray-500 hover:bg-gray-100' },
  bug: { active: 'bg-red-100 text-red-700', inactive: 'text-gray-500 hover:bg-gray-100' },
};

interface AddCardFormProps {
  boardId: string;
  columnId: string;
}

export function AddCardForm({ boardId, columnId }: AddCardFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [cardType, setCardType] = useState<CardType>('task');
  const [submitting, setSubmitting] = useState(false);
  const addCard = useBoardStore((s) => s.addCard);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const card = await cardsApi.createCard(boardId, { title: title.trim(), columnId, cardType });
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
      setCardType('task');
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
      <div className="flex gap-1">
        {([
          { type: 'task' as const, icon: CheckSquare, label: 'Task' },
          { type: 'story' as const, icon: BookOpen, label: 'Story' },
          { type: 'bug' as const, icon: Bug, label: 'Bug' },
        ]).map(({ type, icon: Icon, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => setCardType(type)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              cardType === type
                ? TYPE_PILL_COLORS[type].active
                : TYPE_PILL_COLORS[type].inactive
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>
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
