import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { CollisionPriority } from '@dnd-kit/abstract';
import { Filter, X, Calendar, Activity, Keyboard, Share2, Trash2 } from 'lucide-react';
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
import { CardDetailModal } from './CardDetailModal.js';
import { ActivityFeed } from './ActivityFeed.js';
import { ShortcutHelpModal } from './ShortcutHelpModal.js';
import { SaveAsTemplateButton } from './SaveAsTemplateButton.js';
import { ShareBoardModal } from './ShareBoardModal.js';
import { ConnectionStatus } from '../../components/ui/ConnectionStatus.js';
import { useRealtimeBoard } from '../../hooks/useRealtimeBoard.js';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js';
import { toast } from 'sonner';
import type { Column, CardSummary, CardType } from '@trello-clone/shared';

/** Shape of the DnD event we actually use from @dnd-kit */
interface DragEndEvent {
  canceled: boolean;
  operation: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    source: { id: string | number; type?: string | number | symbol; data?: Record<string, any> } | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    target: { id: string | number; type?: string | number | symbol; data?: Record<string, any> } | null;
  };
}

const ColumnHeader = React.memo(function ColumnHeader({ column, cardCount, index, boardId, canEdit = true }: { column: Column; cardCount: number; index: number; boardId: string; canEdit?: boolean }) {
  const removeColumn = useBoardStore((s) => s.removeColumn);
  const totalCardCount = useBoardStore((s) => s.board?.cards.filter((c) => c.columnId === column.id).length ?? 0);
  const { ref } = useSortable({
    id: column.id,
    index,
    type: 'column',
    collisionPriority: CollisionPriority.Low,
    accept: ['column'],
    data: { columnId: column.id },
  });

  const isOverWipLimit = column.wipLimit !== null && cardCount > column.wipLimit;

  const handleDeleteColumn = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (totalCardCount > 0) {
      toast.error('Spalte kann nicht gelöscht werden, da sie noch Karten enthält');
      return;
    }
    if (!window.confirm(`Spalte "${column.name}" wirklich löschen?`)) return;
    try {
      await columnsApi.deleteColumn(boardId, column.id);
      removeColumn(column.id);
      toast.success('Spalte gelöscht');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Spalte konnte nicht gelöscht werden';
      toast.error(msg);
    }
  };

  return (
    <div
      ref={ref}
      className="p-3 flex items-center gap-2 bg-white sticky top-0 z-10 border-b border-gray-200 cursor-grab active:cursor-grabbing"
    >
      {column.color && (
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />
      )}
      <h3 className="font-semibold text-sm text-gray-700 truncate">{column.name}</h3>
      <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
        isOverWipLimit ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
      }`}>
        {cardCount}
        {column.wipLimit !== null && ` / ${column.wipLimit}`}
      </span>
      {canEdit && (
        <button
          onClick={handleDeleteColumn}
          className="ml-auto p-1 text-gray-400 hover:text-red-600 transition-colors"
          title="Spalte löschen"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
});

export function BoardPage() {
  const { teamId, boardId } = useParams<{ teamId: string; boardId: string }>();
  const navigate = useNavigate();
  const board = useBoardStore((s) => s.board);
  const isLoading = useBoardStore((s) => s.isLoading);
  const setBoard = useBoardStore((s) => s.setBoard);
  const moveCardInStore = useBoardStore((s) => s.moveCard);
  const updateColumn = useBoardStore((s) => s.updateColumn);
  const reorderColumns = useBoardStore((s) => s.reorderColumns);

  // Modal states
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    if (!teamId || !boardId) return;
    const { setLoading: sl, setBoard: sb, clearBoard: cb } = useBoardStore.getState();
    sl(true);
    getBoard(teamId, boardId).then(sb).catch(() => useBoardStore.getState().setLoading(false));
    return () => cb();
  }, [teamId, boardId]);

  // Real-time updates via Socket.IO
  useRealtimeBoard(boardId);

  // Keyboard shortcuts
  const shortcutHandlers = useMemo(
    () => ({
      onShowHelp: () => setShowShortcutHelp(true),
      onNewCard: () => {
        // Focus the first AddCardForm on the page (by clicking its trigger button)
        const addBtn = document.querySelector('[data-add-card-trigger]') as HTMLButtonElement | null;
        addBtn?.click();
      },
      onGoToBoards: () => {
        if (teamId) navigate(`/teams/${teamId}/boards`);
      },
      onFocusFilter: () => {
        const filterBtn = document.querySelector('[data-filter-trigger]') as HTMLButtonElement | null;
        filterBtn?.focus();
      },
      onToggleActivity: () => setShowActivity((prev) => !prev),
    }),
    [teamId, navigate],
  );
  useKeyboardShortcuts(shortcutHandlers);

  // Mobile column tab selector
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<CardType | null>(null);
  const [filterAssigneeId, setFilterAssigneeId] = useState<string | null>(null);
  const [filterLabelIds, setFilterLabelIds] = useState<string[]>([]);
  const [filterDueDate, setFilterDueDate] = useState<'overdue' | 'week' | 'none' | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const hasFilters = filterType !== null || filterAssigneeId !== null || filterLabelIds.length > 0 || filterDueDate !== null;

  // Set default active column when board loads
  useEffect(() => {
    if (board && board.columns.length > 0 && !activeColumnId) {
      setActiveColumnId(board.columns[0].id);
    }
  }, [board, activeColumnId]);

  const isMultiSwimlane = board ? board.swimlanes.length > 1 : false;

  // Get the default swimlane id for single-swimlane mode
  const defaultSwimlaneId = useMemo(() => {
    if (!board) return '';
    const defaultSl = board.swimlanes.find((s) => s.isDefault);
    return defaultSl?.id ?? board.swimlanes[0]?.id ?? '';
  }, [board]);

  // Apply filters to cards
  const filteredCards = useMemo(() => {
    if (!board) return [];
    let cards = board.cards;
    if (filterType) {
      cards = cards.filter((c) => c.cardType === filterType);
    }
    if (filterAssigneeId) {
      cards = cards.filter((c) => c.assignees.some((a) => a.id === filterAssigneeId));
    }
    if (filterLabelIds.length > 0) {
      cards = cards.filter((c) => filterLabelIds.some((lid) => c.labels.some((l) => l.id === lid)));
    }
    if (filterDueDate) {
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (filterDueDate === 'overdue') {
        cards = cards.filter((c) => c.dueDate && new Date(c.dueDate) < now);
      } else if (filterDueDate === 'week') {
        cards = cards.filter((c) => c.dueDate && new Date(c.dueDate) >= now && new Date(c.dueDate) <= weekFromNow);
      } else if (filterDueDate === 'none') {
        cards = cards.filter((c) => !c.dueDate);
      }
    }
    return cards;
  }, [board, filterType, filterAssigneeId, filterLabelIds, filterDueDate]);

  // Collect unique assignees across all cards (for the filter dropdown)
  const allAssignees = useMemo(() => {
    if (!board) return [];
    const map = new Map<string, { id: string; displayName: string }>();
    for (const card of board.cards) {
      for (const a of card.assignees) {
        if (!map.has(a.id)) map.set(a.id, { id: a.id, displayName: a.displayName });
      }
    }
    return [...map.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [board]);

  // Group cards by cell key (columnId:swimlaneId), sorted by position
  const cardsByCell = useMemo(() => {
    if (!board) return {};
    const grouped: Record<string, CardSummary[]> = {};
    for (const col of board.columns) {
      for (const sl of board.swimlanes) {
        grouped[`${col.id}:${sl.id}`] = [];
      }
    }
    for (const card of filteredCards) {
      const key = `${card.columnId}:${card.swimlaneId}`;
      if (grouped[key]) {
        grouped[key].push(card);
      }
    }
    for (const cellKey of Object.keys(grouped)) {
      grouped[cellKey].sort((a, b) => a.position.localeCompare(b.position));
    }
    return grouped;
  }, [board, filteredCards]);

  // For the flat layout, also compute cardsByColumn (all cards in a column regardless of swimlane)
  const cardsByColumn = useMemo(() => {
    if (!board) return {};
    const grouped: Record<string, CardSummary[]> = {};
    for (const col of board.columns) {
      grouped[col.id] = [];
    }
    for (const card of filteredCards) {
      if (grouped[card.columnId]) {
        grouped[card.columnId].push(card);
      }
    }
    for (const colId of Object.keys(grouped)) {
      grouped[colId].sort((a, b) => a.position.localeCompare(b.position));
    }
    return grouped;
  }, [board, filteredCards]);

  const handleDragEnd = async (event: DragEndEvent) => {
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

      // Optimistic reorder: immediately update the store
      const optimisticColumns = [...columns];
      const [moved] = optimisticColumns.splice(sourceIndex, 1);
      const insertAt = sourceIndex > targetIndex ? targetIndex : targetIndex;
      optimisticColumns.splice(insertAt, 0, moved);
      reorderColumns(optimisticColumns);

      try {
        const updated = await columnsApi.moveColumn(board!.id, columnId, { afterId });
        updateColumn(columnId, { position: updated.position });
        const currentColumns = useBoardStore.getState().board?.columns;
        if (currentColumns) {
          const sorted = [...currentColumns].sort((a, b) => a.position.localeCompare(b.position));
          reorderColumns(sorted);
        }
      } catch {
        // Revert on failure by reloading the board
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

    const dropIndex = target.type === 'card'
      ? targetCards.findIndex((c) => c.id === String(target.id))
      : targetCards.length;

    let afterId: string | null = null;
    if (dropIndex > 0) {
      const cardBefore = targetCards[dropIndex - 1];
      if (cardBefore && cardBefore.id !== cardId) {
        afterId = cardBefore.id;
      } else if (dropIndex > 1) {
        afterId = targetCards[dropIndex - 2]?.id ?? null;
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
        <div className="px-2 sm:px-4 py-2 sm:py-4 animate-pulse">
          {/* Header skeleton */}
          <div className="flex items-center gap-4 mb-4">
            <div className="h-4 w-16 bg-gray-200 rounded" />
            <div className="h-6 w-48 bg-gray-200 rounded" />
          </div>
          {/* Column skeletons */}
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map((col) => (
              <div key={col} className="flex-shrink-0 w-72 bg-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-4 w-24 bg-gray-200 rounded" />
                  <div className="h-5 w-8 bg-gray-200 rounded-full" />
                </div>
                {[1, 2, 3].slice(0, col === 2 ? 2 : 3).map((card) => (
                  <div key={card} className="bg-white rounded-lg border border-gray-200 p-3 mb-2">
                    <div className="h-4 w-16 bg-gray-200 rounded mb-2" />
                    <div className="h-4 w-full bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  const permission = board.permission ?? 'edit';
  const canEdit = permission === 'edit';

  const activeColumn = board.columns.find((c) => c.id === activeColumnId) ?? board.columns[0];

  return (
    <AppLayout>
      <div className="px-2 sm:px-4 py-2 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-4">
          <Link to={`/teams/${teamId}/boards`} className="text-sm text-blue-600 hover:underline">
            &larr; Boards
          </Link>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{board.name}</h1>
          <ConnectionStatus />
          {canEdit && <SaveAsTemplateButton boardId={board.id} />}
          {canEdit && (
            <button
              onClick={() => setShowShareModal(true)}
              className="hidden sm:flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <Share2 size={12} />
              Teilen
            </button>
          )}
          <button
            onClick={() => setShowActivity(!showActivity)}
            className={`hidden sm:flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ml-auto ${
              showActivity
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Activity size={12} />
            Aktivität
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
          <button
            onClick={() => {
              if (hasFilters) {
                setFilterType(null);
                setFilterAssigneeId(null);
                setFilterLabelIds([]);
                setFilterDueDate(null);
              }
            }}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
              hasFilters
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-500'
            }`}
          >
            <Filter size={12} />
            Filter
            {hasFilters && <X size={12} />}
          </button>

          {/* Card type filter pills */}
          {(['task', 'story', 'bug'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? null : type)}
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                filterType === type
                  ? type === 'task' ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : type === 'story' ? 'border-green-300 bg-green-50 text-green-700'
                    : 'border-red-300 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}

          {/* Assignee filter */}
          {allAssignees.length > 0 && (
            <select
              value={filterAssigneeId ?? ''}
              onChange={(e) => setFilterAssigneeId(e.target.value || null)}
              className="text-xs px-2 py-1 rounded-full border border-gray-200 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Alle Zuständigen</option>
              {allAssignees.map((a) => (
                <option key={a.id} value={a.id}>{a.displayName}</option>
              ))}
            </select>
          )}

          {/* Label filter pills */}
          {(board.labels ?? []).length > 0 && (
            <>
              <span className="text-xs text-gray-400 hidden sm:inline">|</span>
              {(board.labels ?? []).map((label) => {
                const isActive = filterLabelIds.includes(label.id);
                return (
                  <button
                    key={label.id}
                    onClick={() =>
                      setFilterLabelIds(
                        isActive
                          ? filterLabelIds.filter((id) => id !== label.id)
                          : [...filterLabelIds, label.id],
                      )
                    }
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      isActive
                        ? 'text-white border-transparent'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                    style={isActive ? { backgroundColor: label.color, borderColor: label.color } : undefined}
                  >
                    {!isActive && (
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-1"
                        style={{ backgroundColor: label.color }}
                      />
                    )}
                    {label.name}
                  </button>
                );
              })}
            </>
          )}

          {/* Due date filter */}
          <span className="text-xs text-gray-400 hidden sm:inline">|</span>
          {([
            { key: 'overdue' as const, label: 'Überfällig', color: 'border-red-300 bg-red-50 text-red-700' },
            { key: 'week' as const, label: 'Diese Woche', color: 'border-orange-300 bg-orange-50 text-orange-700' },
            { key: 'none' as const, label: 'Kein Datum', color: 'border-gray-300 bg-gray-50 text-gray-700' },
          ]).map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setFilterDueDate(filterDueDate === key ? null : key)}
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                filterDueDate === key ? color : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {key === 'overdue' || key === 'week' ? <Calendar size={10} className="inline mr-1" /> : null}
              {label}
            </button>
          ))}

          {/* Calendar link */}
          <Link
            to={`/teams/${teamId}/boards/${boardId}/calendar`}
            className="text-xs px-2 py-1 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors inline-flex items-center gap-1"
          >
            <Calendar size={10} />
            Kalender
          </Link>

          {hasFilters && (
            <span className="text-xs text-gray-400">
              {filteredCards.length}/{board.cards.length} Karten
            </span>
          )}
        </div>

        <div className={`flex gap-4 ${showActivity ? 'sm:pr-0' : ''}`}>
        <div className="flex-1 min-w-0">
        <DragDropProvider onDragEnd={handleDragEnd}>
          {/* ---- Mobile: Tab-based single column view ---- */}
          <div className="sm:hidden">
            {/* Column tabs */}
            <div className="flex gap-1 overflow-x-auto pb-2 mb-2 -mx-2 px-2">
              {board.columns.map((column) => {
                const count = (cardsByColumn[column.id] || []).length;
                const isActive = column.id === activeColumn?.id;
                const isOverWip = column.wipLimit !== null && count > column.wipLimit;
                return (
                  <button
                    key={column.id}
                    onClick={() => setActiveColumnId(column.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {column.color && (
                      <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: column.color }} />
                    )}
                    {column.name}
                    <span className={`ml-1 ${isOverWip ? 'text-red-600' : ''}`}>
                      {count}{column.wipLimit !== null ? `/${column.wipLimit}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active column content */}
            {activeColumn && (
              <div className="bg-gray-100 rounded-lg p-2 min-h-[50vh]">
                <div className="space-y-2">
                  {(cardsByColumn[activeColumn.id] || []).map((card, cardIndex) => (
                    <CardComponent
                      key={card.id}
                      card={card}
                      index={cardIndex}
                      columnId={activeColumn.id}
                      swimlaneId={defaultSwimlaneId}
                    />
                  ))}
                </div>
                {canEdit && (
                  <div className="mt-2">
                    <AddCardForm boardId={board.id} columnId={activeColumn.id} swimlaneId={defaultSwimlaneId} />
                  </div>
                )}
              </div>
            )}

            {canEdit && (
              <>
                <div className="mt-3">
                  <AddColumnForm boardId={board.id} />
                </div>
                <div className="mt-2">
                  <AddSwimlaneForm boardId={board.id} />
                </div>
              </>
            )}
          </div>

          {/* ---- Desktop: Original layout ---- */}
          <div className="hidden sm:block">
            {isMultiSwimlane ? (
              /* ---- Multi-swimlane: CSS Grid layout ---- */
              <>
                <div className="overflow-x-auto pb-4">
                  <div
                    className="grid gap-0"
                    style={{
                      gridTemplateColumns: `200px repeat(${board.columns.length}, 272px)`,
                    }}
                  >
                    {/* Header row: empty top-left corner + column headers */}
                    <div className="sticky top-0 bg-white z-10" />
                    {board.columns.map((column, index) => (
                      <ColumnHeader
                        key={column.id}
                        column={column}
                        cardCount={(cardsByColumn[column.id] || []).length}
                        index={index}
                        boardId={board.id}
                        canEdit={canEdit}
                      />
                    ))}

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
                              {canEdit && (
                                <AddCardForm
                                  boardId={board.id}
                                  columnId={column.id}
                                  swimlaneId={swimlane.id}
                                />
                              )}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>

                  {canEdit && (
                    <>
                      {/* Add swimlane button below the grid */}
                      <div className="mt-4 max-w-sm">
                        <AddSwimlaneForm boardId={board.id} />
                      </div>
                    </>
                  )}
                </div>
                {canEdit && (
                  <div className="mt-2">
                    <AddColumnForm boardId={board.id} />
                  </div>
                )}
              </>
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
                      canEdit={canEdit}
                    />
                  ))}
                  {canEdit && <AddColumnForm boardId={board.id} />}
                </div>
                {canEdit && (
                  <div className="mt-4 max-w-sm">
                    <AddSwimlaneForm boardId={board.id} />
                  </div>
                )}
              </>
            )}
          </div>
        </DragDropProvider>
        </div>

        {/* Activity Sidebar */}
        {showActivity && (
          <div className="hidden sm:block w-72 flex-shrink-0">
            <div className="sticky top-0 bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Activity size={14} />
                  Aktivität
                </h3>
                <button
                  onClick={() => setShowActivity(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <ActivityFeed boardId={boardId} maxHeight="calc(100vh - 200px)" />
            </div>
          </div>
        )}
        </div>
        <CardDetailModal />
        <ShareBoardModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} boardId={board.id} />
        <ShortcutHelpModal isOpen={showShortcutHelp} onClose={() => setShowShortcutHelp(false)} />

        {/* Shortcut help trigger button */}
        <button
          onClick={() => setShowShortcutHelp(true)}
          className="hidden sm:flex fixed bottom-4 right-4 w-8 h-8 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 transition-colors shadow-sm z-40"
          title="Tastaturkürzel (?)"
        >
          <Keyboard size={14} />
        </button>
      </div>
    </AppLayout>
  );
}
