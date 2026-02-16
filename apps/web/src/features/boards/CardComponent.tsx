import { useSortable } from '@dnd-kit/react/sortable';
import type { CardSummary } from '@trello-clone/shared';
import { BookOpen, Bug, CheckSquare } from 'lucide-react';
import { useBoardStore } from '../../stores/boardStore.js';

interface CardComponentProps {
  card: CardSummary;
  index: number;
  columnId: string;
  swimlaneId: string;
}

const TYPE_COLORS: Record<string, string> = {
  story: 'bg-green-100 text-green-700',
  bug: 'bg-red-100 text-red-700',
  task: 'bg-blue-100 text-blue-700',
};

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  story: BookOpen,
  bug: Bug,
  task: CheckSquare,
};

export function CardComponent({ card, index, columnId, swimlaneId }: CardComponentProps) {
  const openCard = useBoardStore((s) => s.openCard);
  const { ref, isDragging } = useSortable({
    id: card.id,
    index,
    type: 'card',
    accept: 'card',
    group: `${columnId}:${swimlaneId}`,
    data: { columnId, swimlaneId },
  });

  return (
    <div
      ref={ref}
      onClick={() => {
        if (!isDragging) openCard(card.id);
      }}
      className={`bg-white rounded-lg border border-gray-200 p-3 shadow-sm cursor-pointer transition-shadow hover:shadow-md ${
        isDragging ? 'opacity-50 shadow-lg cursor-grabbing' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        {(() => {
          const TypeIcon = TYPE_ICONS[card.cardType];
          return (
            <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[card.cardType]}`}>
              {TypeIcon && <TypeIcon size={12} />}
              {card.cardType.charAt(0).toUpperCase() + card.cardType.slice(1)}
            </span>
          );
        })()}
      </div>
      <p className="text-sm text-gray-900 mt-1">{card.title}</p>
      {card.assignees.length > 0 && (
        <div className="flex -space-x-1 mt-2">
          {card.assignees.map((assignee) => (
            <div
              key={assignee.id}
              className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center ring-2 ring-white"
              title={assignee.displayName}
            >
              {assignee.displayName.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
