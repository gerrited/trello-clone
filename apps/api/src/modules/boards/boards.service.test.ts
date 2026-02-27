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
      teamMemberships: { findFirst: vi.fn() },
      boards: { findMany: vi.fn() },
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
    transaction: vi.fn(),
  },
  schema: await import('../../db/schema.js'),
}));

vi.mock('../../middleware/boardAccess.js', () => ({
  requireBoardAccess: vi.fn(),
}));

import { db } from '../../db/index.js';
import { requireBoardAccess } from '../../middleware/boardAccess.js';
import { AppError } from '../../middleware/error.js';
import { createBoard, listBoards, getBoard, updateBoard, deleteBoard } from './boards.service.js';

type MockedDb = {
  query: {
    teamMemberships: { findFirst: ReturnType<typeof vi.fn> };
    boards: { findMany: ReturnType<typeof vi.fn> };
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
  transaction: ReturnType<typeof vi.fn>;
};

const dbMock = db as unknown as MockedDb;
const mockRequireBoardAccess = requireBoardAccess as ReturnType<typeof vi.fn>;

const mockBoard = {
  id: 'board-123',
  teamId: 'team-456',
  name: 'Test Board',
  description: 'A test board',
  createdBy: 'user-789',
  isArchived: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockMembership = {
  id: 'mem-001',
  teamId: 'team-456',
  userId: 'user-789',
  role: 'member',
  createdAt: new Date('2026-01-01'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createBoard
// ---------------------------------------------------------------------------

describe('createBoard', () => {
  it('throws 403 when caller is not a team member', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(null);

    await expect(
      createBoard('team-456', 'user-789', { name: 'My Board' }),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Not a member of this team' });
  });

  it('creates board with transaction and returns the board', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockMembership);

    const mockTx = { insert: vi.fn() };
    mockTx.insert
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockBoard]),
        }),
      })
      .mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

    dbMock.transaction.mockImplementation(
      async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    );

    const result = await createBoard('team-456', 'user-789', { name: 'Test Board' });

    expect(result).toEqual(mockBoard);
    expect(dbMock.transaction).toHaveBeenCalledOnce();
    // board + swimlane + 3 columns = 5 inserts
    expect(mockTx.insert).toHaveBeenCalledTimes(5);
  });
});

// ---------------------------------------------------------------------------
// listBoards
// ---------------------------------------------------------------------------

describe('listBoards', () => {
  it('throws 403 when caller is not a member', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(null);

    await expect(listBoards('team-456', 'user-789')).rejects.toMatchObject({
      statusCode: 403,
      message: 'Not a member of this team',
    });
  });

  it('returns list of non-archived boards', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockMembership);
    dbMock.query.boards.findMany.mockResolvedValue([mockBoard]);

    const result = await listBoards('team-456', 'user-789');

    expect(result).toEqual([mockBoard]);
  });
});

// ---------------------------------------------------------------------------
// getBoard
// ---------------------------------------------------------------------------

describe('getBoard', () => {
  const mockColumn = {
    id: 'col-001',
    boardId: 'board-123',
    name: 'To Do',
    position: 'a0',
    wipLimit: null,
    color: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockSwimlane = {
    id: 'swim-001',
    boardId: 'board-123',
    name: 'Default',
    position: 'a0',
    isDefault: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    mockRequireBoardAccess.mockResolvedValue({ board: mockBoard, permission: 'edit' });
    dbMock.query.columns.findMany.mockResolvedValue([mockColumn]);
    dbMock.query.swimlanes.findMany.mockResolvedValue([mockSwimlane]);
    dbMock.query.cards.findMany.mockResolvedValue([]);
    dbMock.query.labels.findMany.mockResolvedValue([]);
    dbMock.query.cardLabels.findMany.mockResolvedValue([]);
    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
  });

  it('calls requireBoardAccess with (boardId, userId, "read")', async () => {
    await getBoard('board-123', 'user-789');

    expect(mockRequireBoardAccess).toHaveBeenCalledWith('board-123', 'user-789', 'read');
  });

  it('returns board with columns, swimlanes, cards, labels, and permission', async () => {
    const result = await getBoard('board-123', 'user-789');

    expect(result.id).toBe('board-123');
    expect(result.columns).toEqual([mockColumn]);
    expect(result.swimlanes).toEqual([mockSwimlane]);
    expect(result.cards).toEqual([]);
    expect(result.labels).toEqual([]);
    expect(result.permission).toBe('edit');
  });

  it('throws when requireBoardAccess rejects', async () => {
    mockRequireBoardAccess.mockRejectedValue(new AppError(403, 'Forbidden'));

    await expect(getBoard('board-123', 'user-789')).rejects.toMatchObject({
      statusCode: 403,
      message: 'Forbidden',
    });
  });
});

// ---------------------------------------------------------------------------
// updateBoard
// ---------------------------------------------------------------------------

describe('updateBoard', () => {
  it('calls requireBoardAccess with "edit"', async () => {
    mockRequireBoardAccess.mockResolvedValue({ board: mockBoard, permission: 'edit' });
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockBoard]),
        }),
      }),
    });

    await updateBoard('board-123', 'user-789', { name: 'Updated' });

    expect(mockRequireBoardAccess).toHaveBeenCalledWith('board-123', 'user-789', 'edit');
  });

  it('updates and returns board', async () => {
    const updatedBoard = { ...mockBoard, name: 'Updated Board' };
    mockRequireBoardAccess.mockResolvedValue({ board: mockBoard, permission: 'edit' });
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updatedBoard]),
        }),
      }),
    });

    const result = await updateBoard('board-123', 'user-789', { name: 'Updated Board' });

    expect(result.name).toBe('Updated Board');
  });
});

// ---------------------------------------------------------------------------
// deleteBoard
// ---------------------------------------------------------------------------

describe('deleteBoard', () => {
  it('calls requireBoardAccess with "edit"', async () => {
    mockRequireBoardAccess.mockResolvedValue({ board: mockBoard, permission: 'edit' });
    dbMock.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    await deleteBoard('board-123', 'user-789');

    expect(mockRequireBoardAccess).toHaveBeenCalledWith('board-123', 'user-789', 'edit');
  });

  it('deletes the board', async () => {
    mockRequireBoardAccess.mockResolvedValue({ board: mockBoard, permission: 'edit' });
    dbMock.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    await deleteBoard('board-123', 'user-789');

    expect(dbMock.delete).toHaveBeenCalledOnce();
  });
});
