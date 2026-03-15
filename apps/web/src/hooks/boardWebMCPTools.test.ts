import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBoardWebMCPTools } from './boardWebMCPTools.js';
import { useBoardStore } from '../stores/boardStore.js';
import type { BoardDetail } from '../api/boards.api.js';
import type { Board, CardSummary, TeamRole } from '@trello-clone/shared';

// All API modules mocked — include every function used by any tool in this file
vi.mock('../api/boards.api.js', () => ({ listBoards: vi.fn() }));
vi.mock('../api/cards.api.js', () => ({
  createCard: vi.fn(),
  updateCard: vi.fn(),
  moveCard: vi.fn(),
  deleteCard: vi.fn(),
}));
vi.mock('../api/assignees.api.js', () => ({
  addAssignee: vi.fn(),
  removeAssignee: vi.fn(),
}));
vi.mock('../api/teams.api.js', () => ({ getTeam: vi.fn() }));

import * as boardsApi from '../api/boards.api.js';
import * as cardsApi from '../api/cards.api.js';
import * as assigneesApi from '../api/assignees.api.js';
import * as teamsApi from '../api/teams.api.js';

// Constants — readable UUIDs
const BOARD_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TEAM_ID  = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const COL_1    = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const COL_2    = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const SWIM_1   = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const CARD_1   = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const CARD_2   = '00000000-0000-0000-0000-000000000001';
const USER_1   = '00000000-0000-0000-0000-000000000002';

const makeCard = (overrides: Partial<CardSummary> = {}): CardSummary => ({
  id: CARD_1,
  columnId: COL_1,
  swimlaneId: SWIM_1,
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
  ...overrides,
});

const makeBoard = (cards: CardSummary[] = []): BoardDetail => ({
  id: BOARD_ID,
  teamId: TEAM_ID,
  name: 'Test Board',
  description: null,
  createdBy: USER_1,
  isArchived: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  columns: [
    { id: COL_1, boardId: BOARD_ID, name: 'To Do', position: 'a0', wipLimit: null, color: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    { id: COL_2, boardId: BOARD_ID, name: 'Done', position: 'b0', wipLimit: 5, color: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  ],
  swimlanes: [
    { id: SWIM_1, boardId: BOARD_ID, name: 'Default', position: 'a0', isDefault: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  ],
  cards,
  labels: [],
});

// Helper: set store state and create tools in one call
const getTools = (cards: CardSummary[] = []) => {
  useBoardStore.setState({ board: makeBoard(cards), isLoading: false, selectedCardId: null });
  return createBoardWebMCPTools({ boardId: BOARD_ID, teamId: TEAM_ID });
};

const getTool = (name: string, cards: CardSummary[] = []) =>
  getTools(cards).find((t) => t.name === name)!;

beforeEach(() => {
  vi.mocked(boardsApi.listBoards).mockReset();
  vi.mocked(cardsApi.createCard).mockReset();
  vi.mocked(cardsApi.updateCard).mockReset();
  vi.mocked(cardsApi.moveCard).mockReset();
  vi.mocked(cardsApi.deleteCard).mockReset();
  vi.mocked(assigneesApi.addAssignee).mockReset();
  vi.mocked(assigneesApi.removeAssignee).mockReset();
  vi.mocked(teamsApi.getTeam).mockReset();
});

// --- Phase 1 tools (migrated, smoke tests) ---

describe('list_current_team_boards', () => {
  it('returns projected board list', async () => {
    const boards: Board[] = [
      { id: 'b-1', teamId: TEAM_ID, name: 'Alpha', description: null, createdBy: 'u', isArchived: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ];
    vi.mocked(boardsApi.listBoards).mockResolvedValue(boards);
    const tool = getTool('list_current_team_boards');
    const result = await tool.execute({});
    expect(boardsApi.listBoards).toHaveBeenCalledWith(TEAM_ID);
    expect(result).toEqual([{ id: 'b-1', name: 'Alpha' }]);
  });
});

describe('list_columns', () => {
  it('returns columns from the board store', async () => {
    const tool = getTool('list_columns');
    const result = await tool.execute({});
    expect(result).toEqual([
      { id: COL_1, name: 'To Do', wipLimit: null },
      { id: COL_2, name: 'Done', wipLimit: 5 },
    ]);
  });

  it('returns [] when board is not loaded', async () => {
    useBoardStore.setState({ board: null, isLoading: true, selectedCardId: null });
    const tool = createBoardWebMCPTools({ boardId: BOARD_ID, teamId: TEAM_ID })
      .find((t) => t.name === 'list_columns')!;
    const result = await tool.execute({});
    expect(result).toEqual([]);
  });
});

describe('create_card', () => {
  it('creates a card and returns it', async () => {
    const apiCard = { id: 'new-1', boardId: BOARD_ID, columnId: COL_1, swimlaneId: SWIM_1, parentCardId: null, cardType: 'task' as const, title: 'My card', description: null, position: 'a0', dueDate: null, isArchived: false, createdBy: USER_1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
    vi.mocked(cardsApi.createCard).mockResolvedValue(apiCard);
    const tool = getTool('create_card');
    const result = await tool.execute({ title: 'My card', columnId: COL_1 });
    expect(cardsApi.createCard).toHaveBeenCalledWith(BOARD_ID, { title: 'My card', columnId: COL_1 });
    expect(result).toEqual(apiCard);
  });
});

// --- Phase 2 read tools ---

describe('list_cards', () => {
  it('returns all cards when no filters provided', async () => {
    const tool = getTool('list_cards', [makeCard({ id: CARD_1 }), makeCard({ id: CARD_2 })]);
    const result = await tool.execute({}) as { id: string }[];
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toContain(CARD_1);
    expect(result.map((c) => c.id)).toContain(CARD_2);
  });

  it('filters by columnId', async () => {
    const cards = [makeCard({ id: CARD_1, columnId: COL_1 }), makeCard({ id: CARD_2, columnId: COL_2 })];
    const tool = getTool('list_cards', cards);
    const result = await tool.execute({ columnId: COL_1 }) as { id: string }[];
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(CARD_1);
  });

  it('filters by search (case-insensitive)', async () => {
    const cards = [makeCard({ id: CARD_1, title: 'Fix login bug' }), makeCard({ id: CARD_2, title: 'Add profile page' })];
    const tool = getTool('list_cards', cards);
    const result = await tool.execute({ search: 'LOGIN' }) as { id: string }[];
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(CARD_1);
  });

  it('throws on invalid columnId UUID', async () => {
    const tool = getTool('list_cards');
    await expect(tool.execute({ columnId: 'not-a-uuid' }))
      .rejects.toThrow('columnId must be a valid UUID. Use list_columns to get valid column IDs.');
  });

  it('returns [] when board is not loaded', async () => {
    useBoardStore.setState({ board: null, isLoading: true, selectedCardId: null });
    const tool = createBoardWebMCPTools({ boardId: BOARD_ID, teamId: TEAM_ID })
      .find((t) => t.name === 'list_cards')!;
    const result = await tool.execute({});
    expect(result).toEqual([]);
  });
});

describe('list_current_team_members', () => {
  it('returns projected member list', async () => {
    vi.mocked(teamsApi.getTeam).mockResolvedValue({
      id: TEAM_ID, name: 'Team', slug: 'team', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      members: [
        { id: 'mem-1', userId: USER_1, role: 'member' as TeamRole, displayName: 'Alice', email: 'alice@example.com', avatarUrl: null },
      ],
    });
    const tool = getTool('list_current_team_members');
    const result = await tool.execute({});
    expect(teamsApi.getTeam).toHaveBeenCalledWith(TEAM_ID);
    expect(result).toEqual([{ id: USER_1, displayName: 'Alice', email: 'alice@example.com' }]);
  });
});

// --- Card write tools ---

describe('update_card', () => {
  const apiCard = {
    id: CARD_1, boardId: BOARD_ID, columnId: COL_1, swimlaneId: SWIM_1,
    parentCardId: null, cardType: 'bug' as const, title: 'Updated title',
    description: null, position: 'a0', dueDate: null, isArchived: false,
    createdBy: USER_1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };

  it('updates card and returns it', async () => {
    vi.mocked(cardsApi.updateCard).mockResolvedValue(apiCard);
    const tool = getTool('update_card', [makeCard()]);
    const result = await tool.execute({ cardId: CARD_1, title: 'Updated title', cardType: 'bug' });
    expect(cardsApi.updateCard).toHaveBeenCalledWith(
      BOARD_ID, CARD_1, { title: 'Updated title', cardType: 'bug' },
    );
    expect(result).toEqual(apiCard);
  });

  it('updates store with CardSummary fields from API response', async () => {
    vi.mocked(cardsApi.updateCard).mockResolvedValue(apiCard);
    const tool = getTool('update_card', [makeCard()]);
    await tool.execute({ cardId: CARD_1, title: 'Updated title', cardType: 'bug' });
    const card = useBoardStore.getState().board?.cards.find((c) => c.id === CARD_1);
    expect(card?.title).toBe('Updated title');
    expect(card?.cardType).toBe('bug');
  });

  it('throws on invalid cardId UUID', async () => {
    const tool = getTool('update_card');
    await expect(tool.execute({ cardId: 'not-a-uuid', title: 'x' }))
      .rejects.toThrow('cardId must be a valid UUID. Use list_cards to get valid card IDs.');
  });

  it('throws with recovery hint on 404', async () => {
    vi.mocked(cardsApi.updateCard).mockRejectedValue({ response: { status: 404 } });
    const tool = getTool('update_card', [makeCard()]);
    await expect(tool.execute({ cardId: CARD_1, title: 'x' }))
      .rejects.toThrow('Card not found. Use list_cards to get valid card IDs.');
  });
});

describe('move_card', () => {
  const apiCard = {
    id: CARD_1, boardId: BOARD_ID, columnId: COL_2, swimlaneId: SWIM_1,
    parentCardId: null, cardType: 'task' as const, title: 'Test card',
    description: null, position: 'a0', dueDate: null, isArchived: false,
    createdBy: USER_1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };

  it('moves to top — sends afterId: null', async () => {
    vi.mocked(cardsApi.moveCard).mockResolvedValue(apiCard);
    const tool = getTool('move_card', [makeCard()]);
    await tool.execute({ cardId: CARD_1, columnId: COL_2, position: 'top' });
    expect(cardsApi.moveCard).toHaveBeenCalledWith(
      BOARD_ID, CARD_1, { columnId: COL_2, afterId: null },
    );
  });

  it('moves to bottom — sends last card in target column as afterId', async () => {
    const existingCard = makeCard({ id: CARD_2, columnId: COL_2, swimlaneId: SWIM_1, position: 'a0' });
    vi.mocked(cardsApi.moveCard).mockResolvedValue(apiCard);
    const tool = getTool('move_card', [makeCard(), existingCard]);
    await tool.execute({ cardId: CARD_1, columnId: COL_2, position: 'bottom' });
    expect(cardsApi.moveCard).toHaveBeenCalledWith(
      BOARD_ID, CARD_1, { columnId: COL_2, afterId: CARD_2 },
    );
  });

  it('moves to bottom with afterId: null when target column is empty', async () => {
    vi.mocked(cardsApi.moveCard).mockResolvedValue(apiCard);
    // Only the card being moved exists; COL_2 is empty
    const tool = getTool('move_card', [makeCard()]);
    await tool.execute({ cardId: CARD_1, columnId: COL_2, position: 'bottom' });
    expect(cardsApi.moveCard).toHaveBeenCalledWith(
      BOARD_ID, CARD_1, { columnId: COL_2, afterId: null },
    );
  });

  it('updates store with values from API response', async () => {
    vi.mocked(cardsApi.moveCard).mockResolvedValue(apiCard);
    const tool = getTool('move_card', [makeCard()]);
    await tool.execute({ cardId: CARD_1, columnId: COL_2, position: 'top' });
    const card = useBoardStore.getState().board?.cards.find((c) => c.id === CARD_1);
    expect(card?.columnId).toBe(COL_2);
    expect(card?.swimlaneId).toBe(SWIM_1);
    expect(card?.position).toBe('a0');
  });
});

describe('delete_card', () => {
  it('deletes card and returns { success: true }', async () => {
    vi.mocked(cardsApi.deleteCard).mockResolvedValue(undefined);
    const tool = getTool('delete_card', [makeCard()]);
    const result = await tool.execute({ cardId: CARD_1 });
    expect(cardsApi.deleteCard).toHaveBeenCalledWith(BOARD_ID, CARD_1);
    expect(result).toEqual({ success: true });
  });

  it('removes card from store', async () => {
    vi.mocked(cardsApi.deleteCard).mockResolvedValue(undefined);
    const tool = getTool('delete_card', [makeCard()]);
    await tool.execute({ cardId: CARD_1 });
    expect(useBoardStore.getState().board?.cards).toHaveLength(0);
  });

  it('throws on invalid cardId UUID', async () => {
    const tool = getTool('delete_card');
    await expect(tool.execute({ cardId: 'not-a-uuid' }))
      .rejects.toThrow('cardId must be a valid UUID. Use list_cards to get valid card IDs.');
  });

  it('throws with recovery hint on 404', async () => {
    vi.mocked(cardsApi.deleteCard).mockRejectedValue({ response: { status: 404 } });
    const tool = getTool('delete_card', [makeCard()]);
    await expect(tool.execute({ cardId: CARD_1 }))
      .rejects.toThrow('Card not found. Use list_cards to get valid card IDs.');
  });
});
