import React, { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router';
import { DragDropProvider } from '@dnd-kit/react';
import { useBoardStore } from '../../stores/boardStore.js';
import { getBoard } from '../../api/boards.api.js';
import * as cardsApi from '../../api/cards.api.js';
import * as columnsApi from '../../api/columns.api.js';
import { AppLayout } from '../../components/layout/AppLayout.js';
import { ColumnComponent } from './ColumnComponent.js';
import { AddColumnForm } from './AddColumnForm.js';
import { AddSwimlaneForm } from './AddSwimlaneForm.js';
import { SwimlaneRowHeader } from './SwimlaneRow.js';
import { CardComponent } from './CardComponent.js';
import { AddCardForm } from './AddCardForm.js';
import type { CardSummary } from '@trello-clone/shared';

export function BoardPage() {
  const { teamId, boardId } = useParams<{ teamId: string; boardId: string }>();
  const board = useBoardStore((s) => s.board);
  const isLoading = useBoardStore((s) => s.isLoading);
  const setBoard = useBoardStore((s) => s.setBoard);
  const setLoading = useBoardStore((s) => s.setLoading);
  const moveCardInStore = useBoardStore((s) => s.moveCard);
  const updateColumn = useBoardStore((s) => s.updateColumn);
  const reorderColumns = useBoardStore((s) => s.reorderColumns);
  const clearBoard = useBoardStore((s) => s.clearBoard);

  useEffect(() => {
    if (!teamId || !boardId) return;
    setLoading(true);
    getBoard(teamId, boardId).then(setBoard).catch(() => setLoading(false));
    return () => clearBoard();
  }, [teamId, boardId, setBoard, setLoading, clearBoard]);

  const isMultiSwimlane = board ? board.swimlanes.length > 1 : false;

  // Get the default swimlane id for single-swimlane mode
  const defaultSwimlaneId = useMemo(() => {
    if (!board) return '';
    const defaultSl = board.swimlanes.find((s) => s.isDefault);
    return defaultSl?.id ?? board.swimlanes[0]?.id ?? '';
  }, [board]);

  // Group cards by cell key (columnId:swimlaneId), sorted by position
  const cardsByCell = useMemo(() => {
    if (!board) return {};
    const grouped: Record<string, CardSummary[]> = {};
    // Initialize cells for all column x swimlane combinations
    for (const col of board.columns) {
      for (const sl of board.swimlanes) {
        grouped[`${col.id}:${sl.id}`] = [];
      }
    }
    for (const card of board.cards) {
      const key = `${card.columnId}:${card.swimlaneId}`;
      if (grouped[key]) {
        grouped[key].push(card);
      }
    }
    for (const cellKey of Object.keys(grouped)) {
      grouped[cellKey].sort((a, b) => a.position.localeCompare(b.position));
    }
    return grouped;
  }, [board]);

  // For the flat layout, also compute cardsByColumn (all cards in a column regardless of swimlane)
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
    if (source.type === 'column') {
      const columnId = String(source.id);
      const targetId = String(target.id);

      if (columnId === targetId) return;

      const columns = board!.columns;
      const targetIndex = columns.findIndex((c) => c.id === targetId);
      const sourceIndex = columns.findIndex((c) => c.id === columnId);

      if (targetIndex === -1) return;

      let afterId: string | null = null;
      if (sourceIndex > targetIndex) {
        afterId = targetIndex > 0 ? columns[targetIndex - 1].id : null;
      } else {
        afterId = columns[targetIndex].id;
      }

      try {
        const updated = await columnsApi.moveColumn(board!.id, columnId, { afterId });
        updateColumn(columnId, { position: updated.position });
        const currentColumns = useBoardStore.getState().board?.columns;
        if (currentColumns) {
          const sorted = [...currentColumns].sort((a, b) => a.position.localeCompare(b.position));
          reorderColumns(sorted);
        }
      } catch {
        if (teamId && boardId) {
          getBoard(teamId, boardId).then(setBoard);
        }
      }
      return;
    }

    const cardId = String(source.id);

    // Determine target column
    const targetColumnId = target.type === 'column'
      ? String(target.id)
      : String(target.data?.columnId ?? target.id);

    // Determine target swimlane
    const sourceSwimlaneId = String(source.data?.swimlaneId ?? defaultSwimlaneId);
    const targetSwimlaneId = target.type === 'column'
      ? sourceSwimlaneId
      : String(target.data?.swimlaneId ?? sourceSwimlaneId);

    // Use the cell-based lookup for multi-swimlane, column-based for single
    const cellKey = `${targetColumnId}:${targetSwimlaneId}`;
    const targetCards = isMultiSwimlane
      ? (cardsByCell[cellKey] || [])
      : (cardsByColumn[targetColumnId] || []);

    const sourceIndex = target.type === 'card'
      ? targetCards.findIndex((c) => c.id === String(target.id))
      : targetCards.length;

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
        swimlaneId: targetSwimlaneId,
      });
      moveCardInStore(cardId, targetColumnId, targetSwimlaneId, updated.position);
    } catch {
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
          {isMultiSwimlane ? (
            /* ---- Multi-swimlane: CSS Grid layout ---- */
            <div className="overflow-x-auto pb-4">
              <div
                className="grid gap-0"
                style={{
                  gridTemplateColumns: `200px repeat(${board.columns.length}, 272px)`,
                }}
              >
                {/* Header row: empty top-left corner + column headers */}
                <div className="sticky top-0 bg-white z-10" />
                {board.columns.map((column) => {
                  const colCards = cardsByColumn[column.id] || [];
                  const isOverWipLimit = column.wipLimit !== null && colCards.length > column.wipLimit;
                  return (
                    <div
                      key={column.id}
                      className="p-3 flex items-center gap-2 bg-white sticky top-0 z-10 border-b border-gray-200"
                    >
                      {column.color && (
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />
                      )}
                      <h3 className="font-semibold text-sm text-gray-700 truncate">{column.name}</h3>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        isOverWipLimit ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {colCards.length}
                        {column.wipLimit !== null && ` / ${column.wipLimit}`}
                      </span>
                    </div>
                  );
                })}

                {/* Swimlane rows */}
                {board.swimlanes.map((swimlane) => (
                  <React.Fragment key={swimlane.id}>
                    {/* Swimlane header cell */}
                    <div
                      className="border-t border-gray-200 bg-gray-50 flex items-start pt-2"
                      style={{ minHeight: '120px' }}
                    >
                      <SwimlaneRowHeader swimlane={swimlane} boardId={board.id} />
                    </div>
                    {/* Card cells for each column */}
                    {board.columns.map((column) => {
                      const cellKey = `${column.id}:${swimlane.id}`;
                      const cellCards = cardsByCell[cellKey] || [];
                      return (
                        <div
                          key={cellKey}
                          className="border-t border-l border-gray-200 bg-gray-50 p-2 space-y-2"
                          style={{ minHeight: '120px' }}
                        >
                          {cellCards.map((card, cardIndex) => (
                            <CardComponent
                              key={card.id}
                              card={card}
                              index={cardIndex}
                              columnId={column.id}
                              swimlaneId={swimlane.id}
                            />
                          ))}
                          <AddCardForm
                            boardId={board.id}
                            columnId={column.id}
                            swimlaneId={swimlane.id}
                          />
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              {/* Add swimlane button below the grid */}
              <div className="mt-4 max-w-sm">
                <AddSwimlaneForm boardId={board.id} />
              </div>
            </div>
          ) : (
            /* ---- Single swimlane: flat layout (identical to original) ---- */
            <>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {board.columns.map((column, index) => (
                  <ColumnComponent
                    key={column.id}
                    column={column}
                    cards={cardsByColumn[column.id] || []}
                    index={index}
                    boardId={board.id}
                    swimlaneId={defaultSwimlaneId}
                  />
                ))}
                <AddColumnForm boardId={board.id} />
              </div>
              <div className="mt-4 max-w-sm">
                <AddSwimlaneForm boardId={board.id} />
              </div>
            </>
          )}
        </DragDropProvider>
      </div>
    </AppLayout>
  );
}
