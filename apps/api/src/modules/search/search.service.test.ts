import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-min-10-chars',
    JWT_REFRESH_SECRET: 'test-refresh-secret-min-10-chars',
    DATABASE_URL: 'postgresql://localhost:5432/test_db',
  },
}));

vi.mock('../../db/index.js', async () => ({
  db: {
    query: {
      boards: { findFirst: vi.fn(), findMany: vi.fn() },
      teamMemberships: { findFirst: vi.fn(), findMany: vi.fn() },
      boardShares: { findMany: vi.fn() },
      cardLabels: { findMany: vi.fn() },
    },
    select: vi.fn(),
  },
  schema: await import('../../db/schema.js'),
}));

import { db } from '../../db/index.js';
import { searchCards } from './search.service.js';

type MockedDb = {
  query: {
    boards: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    teamMemberships: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    boardShares: { findMany: ReturnType<typeof vi.fn> };
    cardLabels: { findMany: ReturnType<typeof vi.fn> };
  };
  select: ReturnType<typeof vi.fn>;
};

const dbMock = db as unknown as MockedDb;

// Build the select chain: select({}).from().innerJoin().innerJoin().where().orderBy().limit().offset()
function makeSearchResult(rows: unknown[]) {
  const offset = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn().mockReturnValue({ offset });
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy });
  const innerJoin2 = vi.fn().mockReturnValue({ where });
  const innerJoin1 = vi.fn().mockReturnValue({ innerJoin: innerJoin2 });
  const from = vi.fn().mockReturnValue({ innerJoin: innerJoin1 });
  return { from };
}

const defaultInput = { q: 'test', limit: 10, offset: 0 };

const mockCardRow = {
  id: 'card-1',
  title: 'Test Card',
  cardType: 'task',
  dueDate: null,
  boardId: 'board-1',
  columnId: 'col-1',
  boardName: 'Test Board',
  teamId: 'team-1',
  columnName: 'To Do',
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.query.boardShares.findMany.mockResolvedValue([]);
  dbMock.query.cardLabels.findMany.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// searchCards — with boardId filter
// ---------------------------------------------------------------------------

describe('searchCards with boardId filter', () => {
  it('throws 404 when board not found', async () => {
    dbMock.query.boards.findFirst.mockResolvedValue(null);

    await expect(
      searchCards('user-1', { ...defaultInput, boardId: 'board-x' }),
    ).rejects.toMatchObject({ statusCode: 404, message: 'Board not found' });
  });

  it('throws 403 when user is not a team member', async () => {
    dbMock.query.boards.findFirst.mockResolvedValue({ id: 'board-1', teamId: 'team-1' });
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(null);

    await expect(
      searchCards('user-1', { ...defaultInput, boardId: 'board-1' }),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Access denied' });
  });

  it('returns matching cards with labels', async () => {
    dbMock.query.boards.findFirst.mockResolvedValue({ id: 'board-1', teamId: 'team-1' });
    dbMock.query.teamMemberships.findFirst.mockResolvedValue({ id: 'mem-1', role: 'member' });
    dbMock.select.mockReturnValue(makeSearchResult([mockCardRow]).from());
    // Re-wire: select() → {from} chain
    dbMock.select.mockReturnValue(makeSearchResult([mockCardRow]));
    dbMock.query.cardLabels.findMany.mockResolvedValue([
      { cardId: 'card-1', label: { id: 'lbl-1', name: 'Bug', color: '#ff0000' } },
    ]);

    const result = await searchCards('user-1', { ...defaultInput, boardId: 'board-1' });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ id: 'card-1', title: 'Test Card' });
    expect(result.results[0].labels).toEqual([{ id: 'lbl-1', name: 'Bug', color: '#ff0000' }]);
    expect(result.hasMore).toBe(false);
  });

  it('returns hasMore=true and trims to limit when results exceed limit', async () => {
    dbMock.query.boards.findFirst.mockResolvedValue({ id: 'board-1', teamId: 'team-1' });
    dbMock.query.teamMemberships.findFirst.mockResolvedValue({ id: 'mem-1' });
    // Return limit+1 rows to signal hasMore
    const rows = Array.from({ length: 11 }, (_, i) => ({ ...mockCardRow, id: `card-${i}` }));
    dbMock.select.mockReturnValue(makeSearchResult(rows));

    const result = await searchCards('user-1', { ...defaultInput, boardId: 'board-1', limit: 10 });

    expect(result.hasMore).toBe(true);
    expect(result.results).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// searchCards — global search (no boardId)
// ---------------------------------------------------------------------------

describe('searchCards without boardId (global)', () => {
  it('returns empty result when user has no memberships', async () => {
    dbMock.query.teamMemberships.findMany.mockResolvedValue([]);

    const result = await searchCards('user-1', defaultInput);

    expect(result).toEqual({ results: [], total: 0, hasMore: false });
  });

  it('returns empty result when accessible board list is empty', async () => {
    dbMock.query.teamMemberships.findMany.mockResolvedValue([{ teamId: 'team-1' }]);
    dbMock.query.boards.findMany.mockResolvedValue([]);

    const result = await searchCards('user-1', defaultInput);

    expect(result).toEqual({ results: [], total: 0, hasMore: false });
  });

  it('searches across all accessible team boards', async () => {
    dbMock.query.teamMemberships.findMany.mockResolvedValue([{ teamId: 'team-1' }]);
    dbMock.query.boards.findMany.mockResolvedValue([{ id: 'board-1' }]);
    dbMock.select.mockReturnValue(makeSearchResult([mockCardRow]));

    const result = await searchCards('user-1', defaultInput);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].id).toBe('card-1');
  });

  it('includes shared boards in accessible board list', async () => {
    dbMock.query.teamMemberships.findMany.mockResolvedValue([{ teamId: 'team-1' }]);
    dbMock.query.boards.findMany.mockResolvedValue([{ id: 'board-1' }]);
    dbMock.query.boardShares.findMany.mockResolvedValue([{ boardId: 'board-2' }]);
    dbMock.select.mockReturnValue(makeSearchResult([{ ...mockCardRow, id: 'card-2', boardId: 'board-2' }]));

    const result = await searchCards('user-1', defaultInput);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].id).toBe('card-2');
  });

  it('returns dueDate as ISO string when card has a due date', async () => {
    dbMock.query.teamMemberships.findMany.mockResolvedValue([{ teamId: 'team-1' }]);
    dbMock.query.boards.findMany.mockResolvedValue([{ id: 'board-1' }]);
    const dueDate = new Date('2025-06-01T00:00:00.000Z');
    dbMock.select.mockReturnValue(makeSearchResult([{ ...mockCardRow, dueDate }]));

    const result = await searchCards('user-1', defaultInput);

    expect(result.results[0].dueDate).toBe('2025-06-01T00:00:00.000Z');
  });
});
