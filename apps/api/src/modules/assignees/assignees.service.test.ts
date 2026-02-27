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
      cards: { findFirst: vi.fn() },
      teamMemberships: { findFirst: vi.fn() },
      cardAssignees: { findMany: vi.fn() },
      users: { findFirst: vi.fn() },
    },
    insert: vi.fn(),
    delete: vi.fn(),
  },
  schema: await import('../../db/schema.js'),
}));

vi.mock('../../middleware/boardAccess.js', () => ({
  requireBoardAccess: vi.fn().mockResolvedValue({
    board: { id: 'board-1', teamId: 'team-1' },
    permission: 'edit',
  }),
}));

import { db } from '../../db/index.js';
import { requireBoardAccess } from '../../middleware/boardAccess.js';
import { addAssignee, removeAssignee, listAssignees } from './assignees.service.js';

type MockedDb = {
  query: {
    cards: { findFirst: ReturnType<typeof vi.fn> };
    teamMemberships: { findFirst: ReturnType<typeof vi.fn> };
    cardAssignees: { findMany: ReturnType<typeof vi.fn> };
    users: { findFirst: ReturnType<typeof vi.fn> };
  };
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const dbMock = db as unknown as MockedDb;

const mockCard = {
  id: 'card-1',
  boardId: 'board-1',
  columnId: 'col-1',
};

const mockUser = {
  id: 'user-2',
  displayName: 'Assignee User',
  avatarUrl: null,
};

const mockMembership = {
  id: 'mem-1',
  teamId: 'team-1',
  userId: 'user-2',
  role: 'member',
};

beforeEach(() => {
  vi.clearAllMocks();
  (requireBoardAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
    board: { id: 'board-1', teamId: 'team-1' },
    permission: 'edit',
  });
  dbMock.query.cards.findFirst.mockResolvedValue(mockCard);
});

// ---------------------------------------------------------------------------
// addAssignee
// ---------------------------------------------------------------------------

describe('addAssignee', () => {
  it('throws 404 when card not found on board', async () => {
    dbMock.query.cards.findFirst.mockResolvedValue(null);

    await expect(
      addAssignee('board-1', 'card-1', 'user-1', { userId: 'user-2' }),
    ).rejects.toMatchObject({ statusCode: 404, message: 'Card not found' });
  });

  it('calls requireBoardAccess with "edit"', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockMembership);
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    dbMock.query.users.findFirst.mockResolvedValue(mockUser);

    await addAssignee('board-1', 'card-1', 'user-1', { userId: 'user-2' });

    expect(requireBoardAccess).toHaveBeenCalledWith('board-1', 'user-1', 'edit');
  });

  it('throws 400 when target user is not a team member', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(null);

    await expect(
      addAssignee('board-1', 'card-1', 'user-1', { userId: 'user-outsider' }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'User is not a member of this team' });
  });

  it('assigns user and returns assignee', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockMembership);
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    dbMock.query.users.findFirst.mockResolvedValue(mockUser);

    const result = await addAssignee('board-1', 'card-1', 'user-1', { userId: 'user-2' });

    expect(result).toEqual({ assignee: mockUser });
    expect(dbMock.insert).toHaveBeenCalledOnce();
  });

  it('throws 409 when user already assigned (DB constraint 23505)', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockMembership);
    const dbError = { code: '23505' };
    dbMock.insert.mockReturnValue({ values: vi.fn().mockRejectedValue(dbError) });

    await expect(
      addAssignee('board-1', 'card-1', 'user-1', { userId: 'user-2' }),
    ).rejects.toMatchObject({ statusCode: 409, message: 'User already assigned to this card' });
  });
});

// ---------------------------------------------------------------------------
// removeAssignee
// ---------------------------------------------------------------------------

describe('removeAssignee', () => {
  it('throws 404 when card not found on board', async () => {
    dbMock.query.cards.findFirst.mockResolvedValue(null);

    await expect(removeAssignee('board-1', 'card-1', 'user-1', 'user-2')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Card not found',
    });
  });

  it('calls requireBoardAccess with "edit" and removes assignee', async () => {
    dbMock.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    await removeAssignee('board-1', 'card-1', 'user-1', 'user-2');

    expect(requireBoardAccess).toHaveBeenCalledWith('board-1', 'user-1', 'edit');
    expect(dbMock.delete).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// listAssignees
// ---------------------------------------------------------------------------

describe('listAssignees', () => {
  it('throws 404 when card not found on board', async () => {
    dbMock.query.cards.findFirst.mockResolvedValue(null);

    await expect(listAssignees('board-1', 'card-1', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Card not found',
    });
  });

  it('calls requireBoardAccess with "read"', async () => {
    dbMock.query.cardAssignees.findMany.mockResolvedValue([]);

    await listAssignees('board-1', 'card-1', 'user-1');

    expect(requireBoardAccess).toHaveBeenCalledWith('board-1', 'user-1', 'read');
  });

  it('returns mapped list of assignee users', async () => {
    dbMock.query.cardAssignees.findMany.mockResolvedValue([
      { user: mockUser },
      { user: { id: 'user-3', displayName: 'Another User', avatarUrl: 'https://example.com/avatar.png' } },
    ]);

    const result = await listAssignees('board-1', 'card-1', 'user-1');

    expect(result).toEqual([
      { id: 'user-2', displayName: 'Assignee User', avatarUrl: null },
      { id: 'user-3', displayName: 'Another User', avatarUrl: 'https://example.com/avatar.png' },
    ]);
  });
});
