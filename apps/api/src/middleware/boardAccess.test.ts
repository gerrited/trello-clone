import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-min-10-chars',
    JWT_REFRESH_SECRET: 'test-refresh-secret-min-10-chars',
    DATABASE_URL: 'postgresql://localhost:5432/test_db',
  },
}));

vi.mock('../db/index.js', async () => {
  return {
    db: {
      query: {
        boards: { findFirst: vi.fn() },
        teamMemberships: { findFirst: vi.fn() },
        boardShares: { findFirst: vi.fn() },
      },
    },
    schema: await import('../db/schema.js'),
  };
});

import { db } from '../db/index.js';
import { requireBoardAccess, resolveBoardToken } from './boardAccess.js';

const dbMock = db as any;

const mockBoard = { id: 'board-1', teamId: 'team-1', name: 'Test Board' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireBoardAccess', () => {
  it('throws 404 when board does not exist', async () => {
    dbMock.query.boards.findFirst.mockResolvedValue(null);

    await expect(requireBoardAccess('missing-board', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Board not found',
    });
  });

  it('returns edit permission for a team member regardless of share settings', async () => {
    dbMock.query.boards.findFirst.mockResolvedValue(mockBoard);
    dbMock.query.teamMemberships.findFirst.mockResolvedValue({ id: 'membership-1', role: 'member' });

    const result = await requireBoardAccess('board-1', 'user-1');

    expect(result.board).toEqual(mockBoard);
    expect(result.permission).toBe('edit');
  });

  it('returns share permission when user has a valid share entry', async () => {
    dbMock.query.boards.findFirst.mockResolvedValue(mockBoard);
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(null);
    dbMock.query.boardShares.findFirst.mockResolvedValue({
      id: 'share-1',
      permission: 'comment',
      expiresAt: null,
    });

    const result = await requireBoardAccess('board-1', 'user-1', 'read');

    expect(result.permission).toBe('comment');
  });

  it('throws 403 when share entry has expired', async () => {
    dbMock.query.boards.findFirst.mockResolvedValue(mockBoard);
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(null);
    dbMock.query.boardShares.findFirst.mockResolvedValue({
      id: 'share-1',
      permission: 'edit',
      expiresAt: new Date(Date.now() - 1000), // 1 second in the past
    });

    await expect(requireBoardAccess('board-1', 'user-1')).rejects.toMatchObject({
      statusCode: 403,
      message: 'Share has expired',
    });
  });

  it('throws 403 when share permission is below the required minimum', async () => {
    dbMock.query.boards.findFirst.mockResolvedValue(mockBoard);
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(null);
    dbMock.query.boardShares.findFirst.mockResolvedValue({
      id: 'share-1',
      permission: 'read',
      expiresAt: null,
    });

    await expect(requireBoardAccess('board-1', 'user-1', 'edit')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("throws 403 when user is neither a team member nor has a share entry", async () => {
    dbMock.query.boards.findFirst.mockResolvedValue(mockBoard);
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(null);
    dbMock.query.boardShares.findFirst.mockResolvedValue(null);

    await expect(requireBoardAccess('board-1', 'user-1')).rejects.toMatchObject({
      statusCode: 403,
      message: 'Not a member of this team',
    });
  });

  it('still grants access when share expiry is in the future', async () => {
    dbMock.query.boards.findFirst.mockResolvedValue(mockBoard);
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(null);
    dbMock.query.boardShares.findFirst.mockResolvedValue({
      id: 'share-1',
      permission: 'edit',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
    });

    const result = await requireBoardAccess('board-1', 'user-1', 'read');
    expect(result.permission).toBe('edit');
  });
});

describe('resolveBoardToken', () => {
  it('throws 404 when share token does not exist', async () => {
    dbMock.query.boardShares.findFirst.mockResolvedValue(null);

    await expect(resolveBoardToken('unknown-token')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Share link not found',
    });
  });

  it('throws 410 when share token has expired', async () => {
    dbMock.query.boardShares.findFirst.mockResolvedValue({
      id: 'share-1',
      boardId: 'board-1',
      permission: 'read',
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(resolveBoardToken('expired-token')).rejects.toMatchObject({
      statusCode: 410,
      message: 'Share link has expired',
    });
  });

  it('throws 404 when the board referenced by the share no longer exists', async () => {
    dbMock.query.boardShares.findFirst.mockResolvedValue({
      id: 'share-1',
      boardId: 'deleted-board',
      permission: 'read',
      expiresAt: null,
    });
    dbMock.query.boards.findFirst.mockResolvedValue(null);

    await expect(resolveBoardToken('valid-token')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Board not found',
    });
  });

  it('throws 403 when token permission is below required minimum', async () => {
    dbMock.query.boardShares.findFirst.mockResolvedValue({
      id: 'share-1',
      boardId: 'board-1',
      permission: 'read',
      expiresAt: null,
    });
    dbMock.query.boards.findFirst.mockResolvedValue(mockBoard);

    await expect(resolveBoardToken('read-only-token', 'edit')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('returns board and permission for a valid share token', async () => {
    dbMock.query.boardShares.findFirst.mockResolvedValue({
      id: 'share-1',
      boardId: 'board-1',
      permission: 'comment',
      expiresAt: null,
    });
    dbMock.query.boards.findFirst.mockResolvedValue(mockBoard);

    const result = await resolveBoardToken('valid-token', 'read');

    expect(result.board).toEqual(mockBoard);
    expect(result.permission).toBe('comment');
  });
});
