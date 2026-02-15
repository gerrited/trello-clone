import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Column, Swimlane, CardSummary } from '@trello-clone/shared';
import type { BoardDetail } from '../api/boards.api.js';

interface BoardState {
  board: BoardDetail | null;
  isLoading: boolean;

  setBoard: (board: BoardDetail) => void;
  clearBoard: () => void;
  setLoading: (loading: boolean) => void;

  // Column actions
  addColumn: (column: Column) => void;
  updateColumn: (columnId: string, updates: Partial<Column>) => void;
  removeColumn: (columnId: string) => void;
  reorderColumns: (columns: Column[]) => void;

  // Card actions
  addCard: (card: CardSummary) => void;
  updateCard: (cardId: string, updates: Partial<CardSummary>) => void;
  removeCard: (cardId: string) => void;
  moveCard: (cardId: string, toColumnId: string, newPosition: string) => void;
}

export const useBoardStore = create<BoardState>()(
  devtools(
    immer((set) => ({
      board: null,
      isLoading: false,

      setBoard: (board) => set((state) => { state.board = board; state.isLoading = false; }),
      clearBoard: () => set((state) => { state.board = null; }),
      setLoading: (loading) => set((state) => { state.isLoading = loading; }),

      addColumn: (column) => set((state) => {
        if (!state.board) return;
        state.board.columns.push(column);
        state.board.columns.sort((a, b) => a.position.localeCompare(b.position));
      }),

      updateColumn: (columnId, updates) => set((state) => {
        if (!state.board) return;
        const col = state.board.columns.find((c) => c.id === columnId);
        if (col) Object.assign(col, updates);
      }),

      removeColumn: (columnId) => set((state) => {
        if (!state.board) return;
        state.board.columns = state.board.columns.filter((c) => c.id !== columnId);
      }),

      reorderColumns: (columns) => set((state) => {
        if (!state.board) return;
        state.board.columns = columns;
      }),

      addCard: (card) => set((state) => {
        if (!state.board) return;
        state.board.cards.push(card);
      }),

      updateCard: (cardId, updates) => set((state) => {
        if (!state.board) return;
        const card = state.board.cards.find((c) => c.id === cardId);
        if (card) Object.assign(card, updates);
      }),

      removeCard: (cardId) => set((state) => {
        if (!state.board) return;
        state.board.cards = state.board.cards.filter((c) => c.id !== cardId);
      }),

      moveCard: (cardId, toColumnId, newPosition) => set((state) => {
        if (!state.board) return;
        const card = state.board.cards.find((c) => c.id === cardId);
        if (card) {
          card.columnId = toColumnId;
          card.position = newPosition;
        }
      }),
    })),
    { name: 'BoardStore' },
  ),
);
