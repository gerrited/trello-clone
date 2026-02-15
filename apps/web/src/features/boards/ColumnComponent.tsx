import { useSortable } from '@dnd-kit/react/sortable';
import { CollisionPriority } from '@dnd-kit/abstract';
import { CardComponent } from './CardComponent.js';
import { AddCardForm } from './AddCardForm.js';
import type { Column, CardSummary } from '@trello-clone/shared';

interface ColumnComponentProps {
  column: Column;
  cards: CardSummary[];
  index: number;
  boardId: string;
  swimlaneId: string;
}

export function ColumnComponent({ column, cards, index, boardId, swimlaneId }: ColumnComponentProps) {
  const { ref } = useSortable({
    id: column.id,
    index,
    type: 'column',
    collisionPriority: CollisionPriority.Low,
    accept: ['card', 'column'],
    data: { columnId: column.id },
  });

  const isOverWipLimit = column.wipLimit !== null && cards.length > column.wipLimit;

  return (
    <div
      ref={ref}
      className="flex-shrink-0 w-72 bg-gray-100 rounded-lg flex flex-col max-h-[calc(100vh-10rem)]"
    >
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {column.color && (
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }} />
          )}
          <h3 className="font-semibold text-sm text-gray-700">{column.name}</h3>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            isOverWipLimit ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
          }`}>
            {cards.length}
            {column.wipLimit !== null && ` / ${column.wipLimit}`}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {cards.map((card, cardIndex) => (
          <CardComponent
            key={card.id}
            card={card}
            index={cardIndex}
            columnId={column.id}
            swimlaneId={swimlaneId}
          />
        ))}
      </div>

      <div className="p-2">
        <AddCardForm boardId={boardId} columnId={column.id} swimlaneId={swimlaneId} />
      </div>
    </div>
  );
}
