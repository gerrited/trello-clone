import { describe, it, expect, beforeEach } from 'vitest';
import { useBoardStore } from './boardStore.js';
import type { BoardDetail } from '../api/boards.api.js';
import type { CardSummary } from '@trello-clone/shared';

const makeCard = (id: string): CardSummary => ({
  id,
  columnId: 'col-1',
  swimlaneId: 'swim-1',
  parentCardId: null,
  cardType: 'task',
  title: 'Test card',
  position: 'a0',
  dueDate: null,
  assignees: [],
  labels: [],
  commentCount: 0,
  subtaskCount: 0,
  subtaskDoneCount: 0,
  attachmentCount: 0,
});

const makeBoard = (): BoardDetail => ({
  id: 'board-1',
  teamId: 'team-1',
  name: 'Board',
  description: null,
  createdBy: 'user-1',
  isArchived: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  columns: [],
  swimlanes: [],
  cards: [],
  labels: [],
});

beforeEach(() => {
  useBoardStore.setState({ board: makeBoard(), isLoading: false, selectedCardId: null });
});

describe('addCard deduplication guard', () => {
  it('adds a card to the store', () => {
    useBoardStore.getState().addCard(makeCard('card-1'));
    expect(useBoardStore.getState().board?.cards).toHaveLength(1);
  });

  it('does not add a duplicate card with the same id', () => {
    const card = makeCard('card-1');
    useBoardStore.getState().addCard(card);
    useBoardStore.getState().addCard(card);
    expect(useBoardStore.getState().board?.cards).toHaveLength(1);
  });

  it('adds two cards with different ids', () => {
    useBoardStore.getState().addCard(makeCard('card-1'));
    useBoardStore.getState().addCard(makeCard('card-2'));
    expect(useBoardStore.getState().board?.cards).toHaveLength(2);
  });
});
