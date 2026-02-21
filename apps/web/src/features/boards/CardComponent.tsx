import React from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import type { CardSummary } from '@trello-clone/shared';
import { BookOpen, Bug, CheckSquare, MessageSquare, Link2, Calendar, Paperclip } from 'lucide-react';
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

function getDueDateStyle(dueDate: string): { className: string; label: string } {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs < 0) {
    return { className: 'bg-red-100 text-red-700', label: 'Ueberfaellig' };
  }
  if (diffHours < 24) {
    return { className: 'bg-orange-100 text-orange-700', label: 'Bald faellig' };
  }
  return { className: 'bg-gray-100 text-gray-600', label: '' };
}

function formatDueDate(dueDate: string): string {
  const d = new Date(dueDate);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export const CardComponent = React.memo(function CardComponent({ card, index, columnId, swimlaneId }: CardComponentProps) {
  const openCard = useBoardStore((s) => s.openCard);
  const { ref, isDragging } = useSortable({
    id: card.id,
    index,
    type: 'card',
    accept: 'card',
    group: `${columnId}:${swimlaneId}`,
    data: { columnId, swimlaneId },
  });

  const dueDateStyle = card.dueDate ? getDueDateStyle(card.dueDate) : null;
  const hasMetadata = card.commentCount > 0 || card.subtaskCount > 0 || card.parentCardId || card.dueDate || card.attachmentCount > 0;

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
      {/* Label chips */}
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {card.labels.map((label) => (
            <span
              key={label.id}
              className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium leading-tight"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

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
      {/* Metadata badges */}
      {hasMetadata && (
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
          {card.parentCardId && (
            <span className="flex items-center gap-0.5" title="Unteraufgabe">
              <Link2 size={12} />
            </span>
          )}
          {card.dueDate && dueDateStyle && (
            <span
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${dueDateStyle.className}`}
              title={dueDateStyle.label || `Faellig am ${formatDueDate(card.dueDate)}`}
            >
              <Calendar size={12} />
              {formatDueDate(card.dueDate)}
            </span>
          )}
          {card.attachmentCount > 0 && (
            <span className="flex items-center gap-1" title="Anhaenge">
              <Paperclip size={12} />
              {card.attachmentCount}
            </span>
          )}
          {card.commentCount > 0 && (
            <span className="flex items-center gap-1" title="Kommentare">
              <MessageSquare size={12} />
              {card.commentCount}
            </span>
          )}
          {card.subtaskCount > 0 && (
            <span className="flex items-center gap-1" title="Unteraufgaben">
              <CheckSquare size={12} />
              <span>
                {card.subtaskDoneCount}/{card.subtaskCount}
              </span>
            </span>
          )}
        </div>
      )}
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
});
