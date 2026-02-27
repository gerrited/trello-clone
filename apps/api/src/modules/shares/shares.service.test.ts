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
      boardShares: { findFirst: vi.fn(), findMany: vi.fn() },
      users: { findFirst: vi.fn() },
      teamMemberships: { findFirst: vi.fn() },
      columns: { findMany: vi.fn() },
      swimlanes: { findMany: vi.fn() },
      cards: { findMany: vi.fn() },
      labels: { findMany: vi.fn() },
      cardLabels: { findMany: vi.fn() },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
  },
  schema: await import('../../db/schema.js'),
}));

vi.mock('../../middleware/boardAccess.js', () => ({
  requireBoardAccess: vi.fn().mockResolvedValue({
    board: { id: 'board-1', teamId: 'team-1' },
    permission: 'edit',
  }),
  resolveBoardToken: vi.fn().mockResolvedValue({
    board: {
      id: 'board-1',
      teamId: 'team-1',
      name: 'Test Board',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    },
    permission: 'read',
  }),
}));

vi.mock('node:crypto', () => ({
  default: {
    randomBytes: vi.fn().mockReturnValue({ toString: vi.fn().mockReturnValue('mock-token-hex') }),
  },
}));

import { db } from '../../db/index.js';
import { requireBoardAccess, resolveBoardToken } from '../../middleware/boardAccess.js';
import {
  listShares,
  createUserShare,
  createLinkShare,
  updateShare,
  deleteShare,
  getBoardByToken,
} from './shares.service.js';

type MockedDb = {
  query: {
    boardShares: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    users: { findFirst: ReturnType<typeof vi.fn> };
    teamMemberships: { findFirst: ReturnType<typeof vi.fn> };
    columns: { findMany: ReturnType<typeof vi.fn> };
    swimlanes: { findMany: ReturnType<typeof vi.fn> };
    cards: { findMany: ReturnType<typeof vi.fn> };
    labels: { findMany: ReturnType<typeof vi.fn> };
    cardLabels: { findMany: ReturnType<typeof vi.fn> };
  };
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
};

const dbMock = db as unknown as MockedDb;

// Build select chain for count queries: select({}).from().where().groupBy() → rows
function makeCountResult(rows: unknown[]) {
  const groupBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ groupBy });
  const from = vi.fn().mockReturnValue({ where });
  return { from };
}

const createdAt = new Date('2024-01-01T00:00:00.000Z');

const mockShare = {
  id: 'share-1',
  boardId: 'board-1',
  userId: 'user-2',
  token: null,
  permission: 'read',
  createdBy: 'user-1',
  expiresAt: null,
  createdAt,
  user: { id: 'user-2', displayName: 'Bob', email: 'bob@example.com', avatarUrl: null },
};

const mockTargetUser = {
  id: 'user-2',
  displayName: 'Bob',
  email: 'bob@example.com',
  avatarUrl: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  (requireBoardAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
    board: { id: 'board-1', teamId: 'team-1' },
    permission: 'edit',
  });
  (resolveBoardToken as ReturnType<typeof vi.fn>).mockResolvedValue({
    board: {
      id: 'board-1',
      teamId: 'team-1',
      name: 'Test Board',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    },
    permission: 'read',
  });
});

// ---------------------------------------------------------------------------
// listShares
// ---------------------------------------------------------------------------

describe('listShares', () => {
  it('calls requireBoardAccess with "edit"', async () => {
    dbMock.query.boardShares.findMany.mockResolvedValue([]);

    await listShares('board-1', 'user-1');

    expect(requireBoardAccess).toHaveBeenCalledWith('board-1', 'user-1', 'edit');
  });

  it('returns mapped shares with ISO createdAt', async () => {
    dbMock.query.boardShares.findMany.mockResolvedValue([mockShare]);

    const result = await listShares('board-1', 'user-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'share-1', permission: 'read' });
    expect(result[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(result[0].expiresAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createUserShare
// ---------------------------------------------------------------------------

describe('createUserShare', () => {
  it('throws 404 when target user not found by email', async () => {
    dbMock.query.users.findFirst.mockResolvedValue(null);

    await expect(
      createUserShare('board-1', 'user-1', { email: 'unknown@example.com', permission: 'read' }),
    ).rejects.toMatchObject({ statusCode: 404, message: 'User not found' });
  });

  it('throws 409 when target user is already a team member', async () => {
    dbMock.query.users.findFirst.mockResolvedValue(mockTargetUser);
    dbMock.query.teamMemberships.findFirst.mockResolvedValue({ id: 'mem-1' });

    await expect(
      createUserShare('board-1', 'user-1', { email: 'bob@example.com', permission: 'read' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'User is already a team member and has full access',
    });
  });

  it('throws 409 when share already exists for user', async () => {
    dbMock.query.users.findFirst.mockResolvedValue(mockTargetUser);
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(null);
    dbMock.query.boardShares.findFirst.mockResolvedValue({ id: 'existing-share' });

    await expect(
      createUserShare('board-1', 'user-1', { email: 'bob@example.com', permission: 'read' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'User already has a share for this board',
    });
  });

  it('creates and returns user share with target user info', async () => {
    dbMock.query.users.findFirst.mockResolvedValue(mockTargetUser);
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(null);
    dbMock.query.boardShares.findFirst.mockResolvedValue(null);
    dbMock.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...mockShare, user: undefined }]),
      }),
    });

    const result = await createUserShare('board-1', 'user-1', {
      email: 'bob@example.com',
      permission: 'read',
    });

    expect(result).toMatchObject({ id: 'share-1' });
    expect(result.user).toMatchObject({ id: 'user-2', email: 'bob@example.com' });
    expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(dbMock.insert).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// createLinkShare
// ---------------------------------------------------------------------------

describe('createLinkShare', () => {
  it('calls requireBoardAccess with "edit"', async () => {
    dbMock.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ ...mockShare, userId: null, token: 'mock-token-hex' }]),
      }),
    });

    await createLinkShare('board-1', 'user-1', { permission: 'read' });

    expect(requireBoardAccess).toHaveBeenCalledWith('board-1', 'user-1', 'edit');
  });

  it('creates link share with generated token', async () => {
    const linkShare = { ...mockShare, userId: null, token: 'mock-token-hex' };
    dbMock.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([linkShare]),
      }),
    });

    const result = await createLinkShare('board-1', 'user-1', { permission: 'read' });

    expect(result.token).toBe('mock-token-hex');
    expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// updateShare
// ---------------------------------------------------------------------------

describe('updateShare', () => {
  it('throws 404 when share not found', async () => {
    dbMock.query.boardShares.findFirst.mockResolvedValue(null);

    await expect(updateShare('board-1', 'share-x', 'user-1', { permission: 'edit' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'Share not found',
    });
  });

  it('updates and returns share', async () => {
    dbMock.query.boardShares.findFirst.mockResolvedValue(mockShare);
    const updated = { ...mockShare, permission: 'edit' };
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updated]),
        }),
      }),
    });

    const result = await updateShare('board-1', 'share-1', 'user-1', { permission: 'edit' });

    expect(result.permission).toBe('edit');
    expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// deleteShare
// ---------------------------------------------------------------------------

describe('deleteShare', () => {
  it('throws 404 when share not found', async () => {
    dbMock.query.boardShares.findFirst.mockResolvedValue(null);

    await expect(deleteShare('board-1', 'share-x', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Share not found',
    });
  });

  it('deletes share when found', async () => {
    dbMock.query.boardShares.findFirst.mockResolvedValue(mockShare);
    dbMock.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    await deleteShare('board-1', 'share-1', 'user-1');

    expect(dbMock.delete).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// getBoardByToken
// ---------------------------------------------------------------------------

describe('getBoardByToken', () => {
  it('returns board data with empty cards when board has no cards', async () => {
    dbMock.query.columns.findMany.mockResolvedValue([]);
    dbMock.query.swimlanes.findMany.mockResolvedValue([]);
    dbMock.query.cards.findMany.mockResolvedValue([]);
    dbMock.query.labels.findMany.mockResolvedValue([]);

    const result = await getBoardByToken('some-token');

    expect(result.board).toMatchObject({ id: 'board-1' });
    expect(result.board.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(result.cards).toEqual([]);
    expect(result.permission).toBe('read');
    expect(resolveBoardToken).toHaveBeenCalledWith('some-token', 'read');
  });

  it('returns board with cards and counts when cards are present', async () => {
    const mockCardItem = {
      id: 'card-1',
      columnId: 'col-done',
      swimlaneId: 'lane-1',
      parentCardId: null,
      cardType: 'task',
      title: 'Card 1',
      position: 'a0',
      dueDate: null,
      assignees: [],
    };
    dbMock.query.columns.findMany.mockResolvedValue([{ id: 'col-done', name: 'Done' }]);
    dbMock.query.swimlanes.findMany.mockResolvedValue([]);
    dbMock.query.cards.findMany.mockResolvedValue([mockCardItem]);
    dbMock.query.labels.findMany.mockResolvedValue([]);
    dbMock.query.cardLabels.findMany.mockResolvedValue([]);

    // Two select calls: comment counts + attachment counts
    dbMock.select
      .mockReturnValueOnce(makeCountResult([{ cardId: 'card-1', count: 3 }]))
      .mockReturnValueOnce(makeCountResult([{ cardId: 'card-1', count: 1 }]));

    const result = await getBoardByToken('some-token');

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].commentCount).toBe(3);
    expect(result.cards[0].attachmentCount).toBe(1);
    expect(result.cards[0].labels).toEqual([]);
  });
});
