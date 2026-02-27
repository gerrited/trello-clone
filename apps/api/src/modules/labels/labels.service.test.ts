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
      labels: { findFirst: vi.fn(), findMany: vi.fn() },
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
import { listLabels, createLabel, updateLabel, deleteLabel, addCardLabel, removeCardLabel } from './labels.service.js';

type MockedDb = {
  query: {
    labels: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    cards: { findFirst: ReturnType<typeof vi.fn> };
  };
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const dbMock = db as unknown as MockedDb;

const mockLabel = {
  id: 'label-1',
  boardId: 'board-1',
  name: 'Bug',
  color: '#ff0000',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCard = {
  id: 'card-1',
  boardId: 'board-1',
  columnId: 'col-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  (requireBoardAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
    board: { id: 'board-1' },
    permission: 'edit',
  });
});

// ---------------------------------------------------------------------------
// listLabels
// ---------------------------------------------------------------------------

describe('listLabels', () => {
  it('calls requireBoardAccess with "read"', async () => {
    dbMock.query.labels.findMany.mockResolvedValue([]);

    await listLabels('board-1', 'user-1');

    expect(requireBoardAccess).toHaveBeenCalledWith('board-1', 'user-1', 'read');
  });

  it('returns labels for the board', async () => {
    dbMock.query.labels.findMany.mockResolvedValue([mockLabel]);

    const result = await listLabels('board-1', 'user-1');

    expect(result).toEqual([mockLabel]);
  });
});

// ---------------------------------------------------------------------------
// createLabel
// ---------------------------------------------------------------------------

describe('createLabel', () => {
  it('calls requireBoardAccess with "edit"', async () => {
    dbMock.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockLabel]),
      }),
    });

    await createLabel('board-1', 'user-1', { name: 'Bug', color: '#ff0000' });

    expect(requireBoardAccess).toHaveBeenCalledWith('board-1', 'user-1', 'edit');
  });

  it('creates and returns label', async () => {
    dbMock.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockLabel]),
      }),
    });

    const result = await createLabel('board-1', 'user-1', { name: 'Bug', color: '#ff0000' });

    expect(result).toEqual(mockLabel);
  });

  it('throws 409 when a label with the same name already exists (DB constraint 23505)', async () => {
    const dbError = { code: '23505' };
    dbMock.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(dbError),
      }),
    });

    await expect(createLabel('board-1', 'user-1', { name: 'Bug', color: '#ff0000' })).rejects.toMatchObject({
      statusCode: 409,
      message: 'A label with this name already exists on this board',
    });
  });
});

// ---------------------------------------------------------------------------
// updateLabel
// ---------------------------------------------------------------------------

describe('updateLabel', () => {
  it('throws 404 when label not found on board', async () => {
    dbMock.query.labels.findFirst.mockResolvedValue(null);

    await expect(updateLabel('board-1', 'label-1', 'user-1', { name: 'Updated' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'Label not found',
    });
  });

  it('updates and returns label', async () => {
    dbMock.query.labels.findFirst.mockResolvedValue(mockLabel);
    const updatedLabel = { ...mockLabel, name: 'Updated' };
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updatedLabel]),
        }),
      }),
    });

    const result = await updateLabel('board-1', 'label-1', 'user-1', { name: 'Updated' });

    expect(result).toEqual(updatedLabel);
  });

  it('throws 409 on duplicate name (DB constraint 23505)', async () => {
    dbMock.query.labels.findFirst.mockResolvedValue(mockLabel);
    const dbError = { code: '23505' };
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(dbError),
        }),
      }),
    });

    await expect(updateLabel('board-1', 'label-1', 'user-1', { name: 'Existing' })).rejects.toMatchObject({
      statusCode: 409,
      message: 'A label with this name already exists on this board',
    });
  });
});

// ---------------------------------------------------------------------------
// deleteLabel
// ---------------------------------------------------------------------------

describe('deleteLabel', () => {
  it('throws 404 when label not found on board', async () => {
    dbMock.query.labels.findFirst.mockResolvedValue(null);

    await expect(deleteLabel('board-1', 'label-1', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Label not found',
    });
  });

  it('deletes label when found', async () => {
    dbMock.query.labels.findFirst.mockResolvedValue(mockLabel);
    dbMock.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    await deleteLabel('board-1', 'label-1', 'user-1');

    expect(dbMock.delete).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// addCardLabel
// ---------------------------------------------------------------------------

describe('addCardLabel', () => {
  it('throws 404 when card not found on board', async () => {
    dbMock.query.cards.findFirst.mockResolvedValue(null);

    await expect(addCardLabel('board-1', 'card-1', 'user-1', 'label-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Card not found',
    });
  });

  it('throws 404 when label not found on board', async () => {
    dbMock.query.cards.findFirst.mockResolvedValue(mockCard);
    dbMock.query.labels.findFirst.mockResolvedValue(null);

    await expect(addCardLabel('board-1', 'card-1', 'user-1', 'label-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Label not found on this board',
    });
  });

  it('assigns label to card and returns label summary', async () => {
    dbMock.query.cards.findFirst.mockResolvedValue(mockCard);
    dbMock.query.labels.findFirst.mockResolvedValue(mockLabel);
    dbMock.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    const result = await addCardLabel('board-1', 'card-1', 'user-1', 'label-1');

    expect(result).toEqual({
      label: { id: 'label-1', name: 'Bug', color: '#ff0000' },
    });
  });

  it('throws 409 when label already assigned (DB constraint 23505)', async () => {
    dbMock.query.cards.findFirst.mockResolvedValue(mockCard);
    dbMock.query.labels.findFirst.mockResolvedValue(mockLabel);
    const dbError = { code: '23505' };
    dbMock.insert.mockReturnValue({
      values: vi.fn().mockRejectedValue(dbError),
    });

    await expect(addCardLabel('board-1', 'card-1', 'user-1', 'label-1')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Label already assigned to this card',
    });
  });
});

// ---------------------------------------------------------------------------
// removeCardLabel
// ---------------------------------------------------------------------------

describe('removeCardLabel', () => {
  it('throws 404 when card not found on board', async () => {
    dbMock.query.cards.findFirst.mockResolvedValue(null);

    await expect(removeCardLabel('board-1', 'card-1', 'user-1', 'label-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Card not found',
    });
  });

  it('removes label from card', async () => {
    dbMock.query.cards.findFirst.mockResolvedValue(mockCard);
    dbMock.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    await removeCardLabel('board-1', 'card-1', 'user-1', 'label-1');

    expect(requireBoardAccess).toHaveBeenCalledWith('board-1', 'user-1', 'edit');
    expect(dbMock.delete).toHaveBeenCalledOnce();
  });
});
