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
      comments: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  schema: await import('../../db/schema.js'),
}));

vi.mock('../../middleware/boardAccess.js', () => ({
  requireBoardAccess: vi.fn().mockResolvedValue({ board: { id: 'board-1' }, permission: 'comment' }),
}));

import { db } from '../../db/index.js';
import { requireBoardAccess } from '../../middleware/boardAccess.js';
import { listComments, createComment, updateComment, deleteComment } from './comments.service.js';

type MockedDb = {
  query: {
    cards: { findFirst: ReturnType<typeof vi.fn> };
    comments: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  };
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const dbMock = db as unknown as MockedDb;

const mockCard = {
  id: 'card-1',
  boardId: 'board-1',
  columnId: 'col-1',
  swimlaneId: 'lane-1',
};

const mockComment = {
  id: 'comment-1',
  cardId: 'card-1',
  authorId: 'user-1',
  body: 'Test comment',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCommentWithAuthor = {
  ...mockComment,
  author: { id: 'user-1', displayName: 'Test User', avatarUrl: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  (requireBoardAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
    board: { id: 'board-1' },
    permission: 'comment',
  });
  // Default: card exists on board
  dbMock.query.cards.findFirst.mockResolvedValue(mockCard);
});

// ---------------------------------------------------------------------------
// listComments
// ---------------------------------------------------------------------------

describe('listComments', () => {
  it('calls requireBoardAccess with "read"', async () => {
    dbMock.query.comments.findMany.mockResolvedValue([]);

    await listComments('board-1', 'card-1', 'user-1');

    expect(requireBoardAccess).toHaveBeenCalledWith('board-1', 'user-1', 'read');
  });

  it('throws 404 when card not found on board', async () => {
    dbMock.query.cards.findFirst.mockResolvedValue(null);

    await expect(listComments('board-1', 'card-1', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Card not found',
    });
  });

  it('returns comments list', async () => {
    dbMock.query.comments.findMany.mockResolvedValue([mockCommentWithAuthor]);

    const result = await listComments('board-1', 'card-1', 'user-1');

    expect(result).toEqual([mockCommentWithAuthor]);
  });
});

// ---------------------------------------------------------------------------
// createComment
// ---------------------------------------------------------------------------

describe('createComment', () => {
  it('calls requireBoardAccess with "comment"', async () => {
    dbMock.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockComment]),
      }),
    });
    dbMock.query.comments.findFirst.mockResolvedValue(mockCommentWithAuthor);

    await createComment('board-1', 'card-1', 'user-1', { body: 'Hello' });

    expect(requireBoardAccess).toHaveBeenCalledWith('board-1', 'user-1', 'comment');
  });

  it('throws 404 when card not found', async () => {
    dbMock.query.cards.findFirst.mockResolvedValue(null);

    await expect(createComment('board-1', 'card-1', 'user-1', { body: 'Hi' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'Card not found',
    });
  });

  it('creates comment and returns it with author', async () => {
    dbMock.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockComment]),
      }),
    });
    dbMock.query.comments.findFirst.mockResolvedValue(mockCommentWithAuthor);

    const result = await createComment('board-1', 'card-1', 'user-1', { body: 'Hello' });

    expect(result).toEqual(mockCommentWithAuthor);
    expect(dbMock.insert).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// updateComment
// ---------------------------------------------------------------------------

describe('updateComment', () => {
  it('calls requireBoardAccess with "comment"', async () => {
    dbMock.query.comments.findFirst.mockResolvedValue(mockComment);
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockComment]),
        }),
      }),
    });
    dbMock.query.comments.findFirst
      .mockResolvedValueOnce(mockComment)
      .mockResolvedValueOnce(mockCommentWithAuthor);

    await updateComment('board-1', 'card-1', 'comment-1', 'user-1', { body: 'Updated' });

    expect(requireBoardAccess).toHaveBeenCalledWith('board-1', 'user-1', 'comment');
  });

  it('throws 404 when card not found', async () => {
    dbMock.query.cards.findFirst.mockResolvedValue(null);

    await expect(
      updateComment('board-1', 'card-1', 'comment-1', 'user-1', { body: 'Updated' }),
    ).rejects.toMatchObject({ statusCode: 404, message: 'Card not found' });
  });

  it('throws 404 when comment not found', async () => {
    dbMock.query.comments.findFirst.mockResolvedValue(null);

    await expect(
      updateComment('board-1', 'card-1', 'comment-1', 'user-1', { body: 'Updated' }),
    ).rejects.toMatchObject({ statusCode: 404, message: 'Comment not found' });
  });

  it('throws 403 when user is not the author', async () => {
    dbMock.query.comments.findFirst.mockResolvedValue({
      ...mockComment,
      authorId: 'other-user',
    });

    await expect(
      updateComment('board-1', 'card-1', 'comment-1', 'user-1', { body: 'Updated' }),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Only the author can edit this comment' });
  });

  it('updates and returns comment with author', async () => {
    const updatedWithAuthor = { ...mockCommentWithAuthor, body: 'Updated body' };
    dbMock.query.comments.findFirst
      .mockResolvedValueOnce(mockComment)      // ownership check
      .mockResolvedValueOnce(updatedWithAuthor); // fetch with author after update
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...mockComment, body: 'Updated body' }]),
        }),
      }),
    });

    const result = await updateComment('board-1', 'card-1', 'comment-1', 'user-1', { body: 'Updated body' });

    expect(result).toEqual(updatedWithAuthor);
  });
});

// ---------------------------------------------------------------------------
// deleteComment
// ---------------------------------------------------------------------------

describe('deleteComment', () => {
  it('throws 404 when card not found', async () => {
    dbMock.query.cards.findFirst.mockResolvedValue(null);

    await expect(deleteComment('board-1', 'card-1', 'comment-1', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Card not found',
    });
  });

  it('throws 404 when comment not found', async () => {
    dbMock.query.comments.findFirst.mockResolvedValue(null);

    await expect(deleteComment('board-1', 'card-1', 'comment-1', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Comment not found',
    });
  });

  it('throws 403 when user is not the author', async () => {
    dbMock.query.comments.findFirst.mockResolvedValue({
      ...mockComment,
      authorId: 'other-user',
    });

    await expect(deleteComment('board-1', 'card-1', 'comment-1', 'user-1')).rejects.toMatchObject({
      statusCode: 403,
      message: 'Only the author can delete this comment',
    });
  });

  it('deletes comment when user is the author', async () => {
    dbMock.query.comments.findFirst.mockResolvedValue(mockComment);
    dbMock.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    await deleteComment('board-1', 'card-1', 'comment-1', 'user-1');

    expect(dbMock.delete).toHaveBeenCalledOnce();
  });
});
