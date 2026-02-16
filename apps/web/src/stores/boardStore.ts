import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Column, Swimlane, CardSummary } from '@trello-clone/shared';
import type { BoardDetail } from '../api/boards.api.js';

interface BoardState {
  board: BoardDetail | null;
  isLoading: boolean;
  selectedCardId: string | null;

  setBoard: (board: BoardDetail) => void;
  clearBoard: () => void;
  setLoading: (loading: boolean) => void;
  openCard: (cardId: string) => void;
  closeCard: () => void;

  // Column actions
  addColumn: (column: Column) => void;
  updateColumn: (columnId: string, updates: Partial<Column>) => void;
  removeColumn: (columnId: string) => void;
  reorderColumns: (columns: Column[]) => void;

  // Swimlane actions
  addSwimlane: (swimlane: Swimlane) => void;
  updateSwimlane: (swimlaneId: string, updates: Partial<Swimlane>) => void;
  removeSwimlane: (swimlaneId: string) => void;
  reorderSwimlanes: (swimlanes: Swimlane[]) => void;

  // Card actions
  addCard: (card: CardSummary) => void;
  updateCard: (cardId: string, updates: Partial<CardSummary>) => void;
  removeCard: (cardId: string) => void;
  moveCard: (cardId: string, toColumnId: string, toSwimlaneId: string, newPosition: string) => void;
}

export const useBoardStore = create<BoardState>()(
  devtools(
    immer((set) => ({
      board: null,
      isLoading: false,
      selectedCardId: null,

      setBoard: (board) => set((state) => { state.board = board; state.isLoading = false; }),
      clearBoard: () => set((state) => { state.board = null; state.selectedCardId = null; }),
      setLoading: (loading) => set((state) => { state.isLoading = loading; }),
      openCard: (cardId) => set((state) => { state.selectedCardId = cardId; }),
      closeCard: () => set((state) => { state.selectedCardId = null; }),

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

      // Swimlane actions
      addSwimlane: (swimlane) => set((state) => {
        if (!state.board) return;
        state.board.swimlanes.push(swimlane);
        state.board.swimlanes.sort((a, b) => a.position.localeCompare(b.position));
      }),

      updateSwimlane: (swimlaneId, updates) => set((state) => {
        if (!state.board) return;
        const sl = state.board.swimlanes.find((s) => s.id === swimlaneId);
        if (sl) Object.assign(sl, updates);
      }),

      removeSwimlane: (swimlaneId) => set((state) => {
        if (!state.board) return;
        state.board.swimlanes = state.board.swimlanes.filter((s) => s.id !== swimlaneId);
      }),

      reorderSwimlanes: (swimlanes) => set((state) => {
        if (!state.board) return;
        state.board.swimlanes = swimlanes;
      }),

      // Card actions
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

      moveCard: (cardId, toColumnId, toSwimlaneId, newPosition) => set((state) => {
        if (!state.board) return;
        const card = state.board.cards.find((c) => c.id === cardId);
        if (card) {
          card.columnId = toColumnId;
          card.swimlaneId = toSwimlaneId;
          card.position = newPosition;
        }
      }),
    })),
    { name: 'BoardStore' },
  ),
);
