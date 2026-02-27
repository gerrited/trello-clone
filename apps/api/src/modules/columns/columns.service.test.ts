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
      columns: { findFirst: vi.fn(), findMany: vi.fn() },
      cards: { findFirst: vi.fn() },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  schema: await import('../../db/schema.js'),
}));

vi.mock('../../middleware/boardAccess.js', () => ({
  requireBoardAccess: vi.fn().mockResolvedValue({ board: { id: 'board-1' }, permission: 'edit' }),
}));

import { db } from '../../db/index.js';
import { requireBoardAccess } from '../../middleware/boardAccess.js';
import { getPositionAfter, getPositionBefore, getPositionBetween } from '../../utils/ordering.js';
import { createColumn, updateColumn, moveColumn, deleteColumn } from './columns.service.js';

// Real fractional-indexing keys — 'a0'/'b0' are not valid keys for this library
const pos1 = getPositionAfter(null);
const pos2 = getPositionAfter(pos1);

type MockedDb = {
  query: {
    columns: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    cards: { findFirst: ReturnType<typeof vi.fn> };
  };
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const dbMock = db as unknown as MockedDb;
const requireBoardAccessMock = requireBoardAccess as ReturnType<typeof vi.fn>;

const mockColumn = {
  id: 'col-1',
  boardId: 'board-1',
  name: 'Test Column',
  position: 'a0',
  color: null,
  wipLimit: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setupInsertReturning(data: unknown[]) {
  dbMock.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(data),
    }),
  });
}

function setupUpdateReturning(data: unknown[]) {
  dbMock.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(data),
      }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireBoardAccessMock.mockResolvedValue({ board: { id: 'board-1' }, permission: 'edit' });
});

// ---------------------------------------------------------------------------
// createColumn
// ---------------------------------------------------------------------------

describe('createColumn', () => {
  it('calls requireBoardAccess with (boardId, userId, "edit")', async () => {
    dbMock.query.columns.findMany.mockResolvedValue([]);
    setupInsertReturning([mockColumn]);

    await createColumn('board-1', 'user-1', { name: 'New Column' });

    expect(requireBoardAccessMock).toHaveBeenCalledWith('board-1', 'user-1', 'edit');
  });

  it('inserts column after the last existing position', async () => {
    dbMock.query.columns.findMany.mockResolvedValue([{ position: pos1 }, { position: pos2 }]);
    setupInsertReturning([mockColumn]);

    await createColumn('board-1', 'user-1', { name: 'New Column' });

    const insertCall = dbMock.insert.mock.results[0].value;
    const inserted = insertCall.values.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.position).toBe(getPositionAfter(pos2));
  });

  it('inserts at getPositionAfter(null) when board has no existing columns', async () => {
    dbMock.query.columns.findMany.mockResolvedValue([]);
    setupInsertReturning([mockColumn]);

    await createColumn('board-1', 'user-1', { name: 'First Column' });

    const insertCall = dbMock.insert.mock.results[0].value;
    const inserted = insertCall.values.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.position).toBe(getPositionAfter(null));
  });
});

// ---------------------------------------------------------------------------
// updateColumn
// ---------------------------------------------------------------------------

describe('updateColumn', () => {
  it('throws 404 when column is not found', async () => {
    dbMock.query.columns.findFirst.mockResolvedValue(null);

    await expect(updateColumn('col-missing', 'user-1', { name: 'Updated' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'Column not found',
    });
  });

  it('calls requireBoardAccess when column exists', async () => {
    dbMock.query.columns.findFirst.mockResolvedValue(mockColumn);
    setupUpdateReturning([mockColumn]);

    await updateColumn('col-1', 'user-1', { name: 'Updated' });

    expect(requireBoardAccessMock).toHaveBeenCalledWith('board-1', 'user-1', 'edit');
  });

  it('updates and returns the column', async () => {
    const updatedColumn = { ...mockColumn, name: 'Updated Name' };
    dbMock.query.columns.findFirst.mockResolvedValue(mockColumn);
    setupUpdateReturning([updatedColumn]);

    const result = await updateColumn('col-1', 'user-1', { name: 'Updated Name' });

    expect(result).toEqual(updatedColumn);
  });
});

// ---------------------------------------------------------------------------
// moveColumn
// ---------------------------------------------------------------------------

describe('moveColumn', () => {
  const twoColumns = [
    { id: 'col-1', position: pos1, boardId: 'board-1' },
    { id: 'col-2', position: pos2, boardId: 'board-1' },
  ];

  it('throws 404 when column is not found', async () => {
    dbMock.query.columns.findFirst.mockResolvedValue(null);

    await expect(moveColumn('col-missing', 'user-1', null)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Column not found',
    });
  });

  it('moves to beginning when afterId is null', async () => {
    dbMock.query.columns.findFirst.mockResolvedValue(mockColumn);
    dbMock.query.columns.findMany.mockResolvedValue(twoColumns);
    setupUpdateReturning([mockColumn]);

    await moveColumn('col-1', 'user-1', null);

    const setData = dbMock.update.mock.results[0].value.set.mock.calls[0][0] as Record<string, unknown>;
    expect(setData.position).toBe(getPositionBefore(pos1));
  });

  it('moves between col-1 and col-2 when afterId is col-1', async () => {
    dbMock.query.columns.findFirst.mockResolvedValue({ ...mockColumn, id: 'col-moving' });
    dbMock.query.columns.findMany.mockResolvedValue(twoColumns);
    setupUpdateReturning([mockColumn]);

    await moveColumn('col-moving', 'user-1', 'col-1');

    const setData = dbMock.update.mock.results[0].value.set.mock.calls[0][0] as Record<string, unknown>;
    expect(setData.position).toBe(getPositionBetween(pos1, pos2));
  });

  it('throws 404 when afterId is not in the columns list', async () => {
    dbMock.query.columns.findFirst.mockResolvedValue(mockColumn);
    dbMock.query.columns.findMany.mockResolvedValue(twoColumns);

    await expect(moveColumn('col-1', 'user-1', 'col-nonexistent')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Target column not found',
    });
  });
});

// ---------------------------------------------------------------------------
// deleteColumn
// ---------------------------------------------------------------------------

describe('deleteColumn', () => {
  it('throws 404 when column is not found', async () => {
    dbMock.query.columns.findFirst.mockResolvedValue(null);

    await expect(deleteColumn('col-missing', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Column not found',
    });
  });

  it('throws 400 when column contains cards', async () => {
    dbMock.query.columns.findFirst.mockResolvedValue(mockColumn);
    dbMock.query.cards.findFirst.mockResolvedValue({ id: 'card-1', columnId: 'col-1' });

    await expect(deleteColumn('col-1', 'user-1')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Cannot delete column that contains cards',
    });
  });

  it('deletes the column when empty', async () => {
    dbMock.query.columns.findFirst.mockResolvedValue(mockColumn);
    dbMock.query.cards.findFirst.mockResolvedValue(null);
    dbMock.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    await deleteColumn('col-1', 'user-1');

    expect(dbMock.delete).toHaveBeenCalled();
  });
});
