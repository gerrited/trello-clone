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
      swimlanes: { findFirst: vi.fn(), findMany: vi.fn() },
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
import { getPositionAfter } from '../../utils/ordering.js';
import { createSwimlane, updateSwimlane, moveSwimlane, deleteSwimlane } from './swimlanes.service.js';

// Real fractional-indexing keys — 'a0'/'b0' are not valid keys for this library
const pos1 = getPositionAfter(null);
const pos2 = getPositionAfter(pos1);

type MockedDb = {
  query: {
    swimlanes: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    cards: { findFirst: ReturnType<typeof vi.fn> };
  };
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const dbMock = db as unknown as MockedDb;

const mockSwimlane = {
  id: 'lane-1',
  boardId: 'board-1',
  name: 'Default',
  position: 'a0',
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (requireBoardAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
    board: { id: 'board-1' },
    permission: 'edit',
  });
});

// ---------------------------------------------------------------------------
// createSwimlane
// ---------------------------------------------------------------------------

describe('createSwimlane', () => {
  it('calls requireBoardAccess and appends after last existing swimlane', async () => {
    dbMock.query.swimlanes.findMany.mockResolvedValue([{ position: 'a0' }]);
    dbMock.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockSwimlane]),
      }),
    });

    const result = await createSwimlane('board-1', 'user-1', { name: 'New Swimlane' });

    expect(requireBoardAccess).toHaveBeenCalledWith('board-1', 'user-1', 'edit');
    const insertedData = dbMock.insert.mock.results[0].value.values.mock.calls[0][0] as Record<string, unknown>;
    expect((insertedData.position as string) > 'a0').toBe(true);
    expect(result).toEqual(mockSwimlane);
  });

  it('creates swimlane when board has no existing swimlanes', async () => {
    dbMock.query.swimlanes.findMany.mockResolvedValue([]);
    dbMock.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockSwimlane]),
      }),
    });

    await createSwimlane('board-1', 'user-1', { name: 'First Swimlane' });

    const insertedData = dbMock.insert.mock.results[0].value.values.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof insertedData.position).toBe('string');
    expect((insertedData.position as string).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// updateSwimlane
// ---------------------------------------------------------------------------

describe('updateSwimlane', () => {
  it('throws 404 when swimlane not found', async () => {
    dbMock.query.swimlanes.findFirst.mockResolvedValue(null);

    await expect(updateSwimlane('nonexistent', 'user-1', { name: 'Updated' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'Swimlane not found',
    });
  });

  it('updates and returns swimlane', async () => {
    dbMock.query.swimlanes.findFirst.mockResolvedValue(mockSwimlane);
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSwimlane]),
        }),
      }),
    });

    const result = await updateSwimlane('lane-1', 'user-1', { name: 'Updated Name' });

    expect(requireBoardAccess).toHaveBeenCalledWith('board-1', 'user-1', 'edit');
    expect(result).toEqual(mockSwimlane);
  });
});

// ---------------------------------------------------------------------------
// moveSwimlane
// ---------------------------------------------------------------------------

describe('moveSwimlane', () => {
  const twoSwimlanes = [
    { id: 'lane-1', position: pos1, boardId: 'board-1' },
    { id: 'lane-2', position: pos2, boardId: 'board-1' },
  ];

  beforeEach(() => {
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSwimlane]),
        }),
      }),
    });
  });

  it('throws 404 when swimlane not found', async () => {
    dbMock.query.swimlanes.findFirst.mockResolvedValue(null);

    await expect(moveSwimlane('nonexistent', 'user-1', null)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Swimlane not found',
    });
  });

  it('moves to beginning when afterId is null', async () => {
    dbMock.query.swimlanes.findFirst.mockResolvedValue(mockSwimlane);
    dbMock.query.swimlanes.findMany.mockResolvedValue(twoSwimlanes);

    await moveSwimlane('lane-1', 'user-1', null);

    const setData = dbMock.update.mock.results[0].value.set.mock.calls[0][0] as Record<string, unknown>;
    expect((setData.position as string) < 'a0').toBe(true);
  });

  it('moves between lane-1 and lane-2 when afterId is lane-1', async () => {
    dbMock.query.swimlanes.findFirst.mockResolvedValue({ ...mockSwimlane, id: 'lane-3', position: 'c0' });
    dbMock.query.swimlanes.findMany.mockResolvedValue(twoSwimlanes);

    await moveSwimlane('lane-3', 'user-1', 'lane-1');

    const setData = dbMock.update.mock.results[0].value.set.mock.calls[0][0] as Record<string, unknown>;
    expect((setData.position as string) > 'a0').toBe(true);
    expect((setData.position as string) < 'b0').toBe(true);
  });

  it('throws 404 when afterId does not match any swimlane', async () => {
    dbMock.query.swimlanes.findFirst.mockResolvedValue(mockSwimlane);
    dbMock.query.swimlanes.findMany.mockResolvedValue(twoSwimlanes);

    await expect(moveSwimlane('lane-1', 'user-1', 'nonexistent')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Target swimlane not found',
    });
  });
});

// ---------------------------------------------------------------------------
// deleteSwimlane
// ---------------------------------------------------------------------------

describe('deleteSwimlane', () => {
  it('throws 404 when swimlane not found', async () => {
    dbMock.query.swimlanes.findFirst.mockResolvedValue(null);

    await expect(deleteSwimlane('nonexistent', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Swimlane not found',
    });
  });

  it('throws 400 when swimlane is the default', async () => {
    dbMock.query.swimlanes.findFirst.mockResolvedValue({ ...mockSwimlane, isDefault: true });

    await expect(deleteSwimlane('lane-1', 'user-1')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Cannot delete the default swimlane',
    });
  });

  it('throws 400 when swimlane contains cards', async () => {
    dbMock.query.swimlanes.findFirst.mockResolvedValue(mockSwimlane);
    dbMock.query.cards.findFirst.mockResolvedValue({ id: 'card-1', swimlaneId: 'lane-1' });

    await expect(deleteSwimlane('lane-1', 'user-1')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Cannot delete swimlane that contains cards',
    });
  });

  it('deletes swimlane when not default and no cards', async () => {
    dbMock.query.swimlanes.findFirst.mockResolvedValue(mockSwimlane);
    dbMock.query.cards.findFirst.mockResolvedValue(null);
    dbMock.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    await deleteSwimlane('lane-1', 'user-1');

    expect(requireBoardAccess).toHaveBeenCalledWith('board-1', 'user-1', 'edit');
    expect(dbMock.delete).toHaveBeenCalled();
  });
});
