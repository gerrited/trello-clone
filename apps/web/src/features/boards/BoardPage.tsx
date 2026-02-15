import { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router';
import { DragDropProvider } from '@dnd-kit/react';
import { useBoardStore } from '../../stores/boardStore.js';
import { getBoard } from '../../api/boards.api.js';
import * as cardsApi from '../../api/cards.api.js';
import { AppLayout } from '../../components/layout/AppLayout.js';
import { ColumnComponent } from './ColumnComponent.js';
import { AddColumnForm } from './AddColumnForm.js';
import type { CardSummary } from '@trello-clone/shared';

export function BoardPage() {
  const { teamId, boardId } = useParams<{ teamId: string; boardId: string }>();
  const board = useBoardStore((s) => s.board);
  const isLoading = useBoardStore((s) => s.isLoading);
  const setBoard = useBoardStore((s) => s.setBoard);
  const setLoading = useBoardStore((s) => s.setLoading);
  const moveCardInStore = useBoardStore((s) => s.moveCard);
  const clearBoard = useBoardStore((s) => s.clearBoard);

  useEffect(() => {
    if (!teamId || !boardId) return;
    setLoading(true);
    getBoard(teamId, boardId).then(setBoard).catch(() => setLoading(false));
    return () => clearBoard();
  }, [teamId, boardId, setBoard, setLoading, clearBoard]);

  // Group cards by column, sorted by position
  const cardsByColumn = useMemo(() => {
    if (!board) return {};
    const grouped: Record<string, CardSummary[]> = {};
    for (const col of board.columns) {
      grouped[col.id] = [];
    }
    for (const card of board.cards) {
      if (grouped[card.columnId]) {
        grouped[card.columnId].push(card);
      }
    }
    for (const colId of Object.keys(grouped)) {
      grouped[colId].sort((a, b) => a.position.localeCompare(b.position));
    }
    return grouped;
  }, [board]);

  const handleDragEnd = async (event: any) => {
    const { source, target } = event.operation;
    if (event.canceled || !source || !target) return;
    if (source.type === 'column') return; // Column reorder deferred to Layer 2

    const cardId = String(source.id);

    // Determine target column -- if dropped on a column directly, use that column's id;
    // if dropped on/near a card, use that card's column
    const targetColumnId = target.type === 'column'
      ? String(target.id)
      : String(target.data?.columnId ?? target.id);

    // Find the updated card order in the target column after the drag
    const targetCards = cardsByColumn[targetColumnId] || [];

    // Find where the card was dropped -- the card's new index in the target column
    // The source index in the target column gives us the position after dnd-kit reorder
    const sourceIndex = target.type === 'card'
      ? targetCards.findIndex((c) => c.id === String(target.id))
      : targetCards.length; // dropped on empty column

    // The afterId is the card just before the drop position
    let afterId: string | null = null;
    if (sourceIndex > 0) {
      const cardBefore = targetCards[sourceIndex - 1];
      if (cardBefore && cardBefore.id !== cardId) {
        afterId = cardBefore.id;
      } else if (sourceIndex > 1) {
        afterId = targetCards[sourceIndex - 2]?.id ?? null;
      }
    }

    try {
      const updated = await cardsApi.moveCard(board!.id, cardId, {
        columnId: targetColumnId,
        afterId,
      });
      moveCardInStore(cardId, targetColumnId, updated.position);
    } catch {
      // Reload board on error to reset state
      if (teamId && boardId) {
        getBoard(teamId, boardId).then(setBoard);
      }
    }
  };

  if (isLoading || !board) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Board wird geladen...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 py-4">
        <div className="flex items-center gap-4 mb-4">
          <Link to={`/teams/${teamId}/boards`} className="text-sm text-blue-600 hover:underline">
            &larr; Boards
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{board.name}</h1>
        </div>

        <DragDropProvider onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {board.columns.map((column, index) => (
              <ColumnComponent
                key={column.id}
                column={column}
                cards={cardsByColumn[column.id] || []}
                index={index}
                boardId={board.id}
              />
            ))}
            <AddColumnForm boardId={board.id} />
          </div>
        </DragDropProvider>
      </div>
    </AppLayout>
  );
}
