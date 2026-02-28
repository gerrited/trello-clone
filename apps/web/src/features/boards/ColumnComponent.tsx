import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { CollisionPriority } from '@dnd-kit/abstract';
import { Trash2 } from 'lucide-react';
import { CardComponent } from './CardComponent.js';
import { AddCardForm } from './AddCardForm.js';
import { useBoardStore } from '../../stores/boardStore.js';
import * as columnsApi from '../../api/columns.api.js';
import { toast } from 'sonner';
import type { Column, CardSummary } from '@trello-clone/shared';

interface ColumnComponentProps {
  column: Column;
  cards: CardSummary[];
  index: number;
  boardId: string;
  swimlaneId: string;
  canEdit?: boolean;
}

export const ColumnComponent = React.memo(function ColumnComponent({ column, cards, index, boardId, swimlaneId, canEdit = true }: ColumnComponentProps) {
  const removeColumn = useBoardStore((s) => s.removeColumn);
  const totalCardCount = useBoardStore((s) => s.board?.cards.filter((c) => c.columnId === column.id).length ?? 0);
  const [deleting, setDeleting] = useState(false);

  const { ref } = useSortable({
    id: column.id,
    index,
    type: 'column',
    collisionPriority: CollisionPriority.Low,
    accept: ['column'],
    data: { columnId: column.id },
  });

  const { ref: dropRef } = useDroppable({
    id: `column-drop:${column.id}`,
    type: 'column-body',
    accept: ['card'],
    collisionPriority: CollisionPriority.Low,
    data: { columnId: column.id, swimlaneId },
  });

  const isOverWipLimit = column.wipLimit !== null && cards.length > column.wipLimit;

  const handleDeleteColumn = async () => {
    if (totalCardCount > 0) {
      toast.error('Spalte kann nicht gelöscht werden, da sie noch Karten enthält');
      return;
    }
    if (!window.confirm(`Spalte "${column.name}" wirklich löschen?`)) return;
    setDeleting(true);
    try {
      await columnsApi.deleteColumn(boardId, column.id);
      removeColumn(column.id);
      toast.success('Spalte gelöscht');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Spalte konnte nicht gelöscht werden';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      ref={ref}
      className="flex-shrink-0 w-full sm:w-72 bg-gray-100 rounded-lg flex flex-col max-h-[calc(100vh-14rem)] sm:max-h-[calc(100vh-10rem)]"
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
        {canEdit && (
          <button
            onClick={handleDeleteColumn}
            disabled={deleting}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
            title="Spalte löschen"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div ref={dropRef} className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {cards.map((card, cardIndex) => (
          <CardComponent
            key={card.id}
            card={card}
            index={cardIndex}
            columnId={column.id}
            swimlaneId={swimlaneId}
            boardId={boardId}
          />
        ))}
      </div>

      {canEdit && (
        <div className="p-2">
          <AddCardForm boardId={boardId} columnId={column.id} swimlaneId={swimlaneId} />
        </div>
      )}
    </div>
  );
});
