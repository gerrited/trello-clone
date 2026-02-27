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
      boardTemplates: { findFirst: vi.fn(), findMany: vi.fn() },
      boards: { findFirst: vi.fn() },
      columns: { findMany: vi.fn() },
      swimlanes: { findMany: vi.fn() },
      labels: { findMany: vi.fn() },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
  schema: await import('../../db/schema.js'),
}));

import { db } from '../../db/index.js';
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createBoardFromTemplate,
  saveAsTemplate,
  ensureSystemTemplates,
} from './templates.service.js';

type MockedDb = {
  query: {
    teamMemberships: { findFirst: ReturnType<typeof vi.fn> };
    boardTemplates: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    boards: { findFirst: ReturnType<typeof vi.fn> };
    columns: { findMany: ReturnType<typeof vi.fn> };
    swimlanes: { findMany: ReturnType<typeof vi.fn> };
    labels: { findMany: ReturnType<typeof vi.fn> };
  };
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
};

const dbMock = db as unknown as MockedDb;

const mockMembership = { id: 'mem-1', teamId: 'team-1', userId: 'user-1', role: 'member' };
const createdAt = new Date('2024-01-01T00:00:00.000Z');
const updatedAt = new Date('2024-01-01T00:00:00.000Z');

const mockTemplate = {
  id: 'tmpl-1',
  teamId: 'team-1',
  name: 'My Template',
  description: null,
  isSystem: false,
  createdBy: 'user-1',
  config: { columns: [], swimlanes: [], labels: [] },
  createdAt,
  updatedAt,
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.query.teamMemberships.findFirst.mockResolvedValue(mockMembership);
});

// ---------------------------------------------------------------------------
// listTemplates
// ---------------------------------------------------------------------------

describe('listTemplates', () => {
  it('throws 403 when user is not a team member', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(null);

    await expect(listTemplates('team-1', 'user-1')).rejects.toMatchObject({
      statusCode: 403,
      message: 'Not a member of this team',
    });
  });

  it('returns templates with ISO dates', async () => {
    dbMock.query.boardTemplates.findMany.mockResolvedValue([mockTemplate]);

    const result = await listTemplates('team-1', 'user-1');

    expect(result).toHaveLength(1);
    expect(result[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(result[0].updatedAt).toBe('2024-01-01T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// createTemplate
// ---------------------------------------------------------------------------

describe('createTemplate', () => {
  it('throws 403 when user is not a team member', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(null);

    await expect(
      createTemplate('team-1', 'user-1', { name: 'T', config: { columns: [], swimlanes: [], labels: [] } }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('creates and returns template with ISO dates', async () => {
    dbMock.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockTemplate]),
      }),
    });

    const result = await createTemplate('team-1', 'user-1', {
      name: 'My Template',
      config: { columns: [], swimlanes: [], labels: [] },
    });

    expect(result).toMatchObject({ id: 'tmpl-1', name: 'My Template' });
    expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(dbMock.insert).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// updateTemplate
// ---------------------------------------------------------------------------

describe('updateTemplate', () => {
  it('throws 404 when template not found', async () => {
    dbMock.query.boardTemplates.findFirst.mockResolvedValue(null);

    await expect(updateTemplate('team-1', 'tmpl-1', 'user-1', { name: 'Updated' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'Template not found',
    });
  });

  it('throws 403 when template is a system template', async () => {
    dbMock.query.boardTemplates.findFirst.mockResolvedValue({ ...mockTemplate, isSystem: true });

    await expect(updateTemplate('team-1', 'tmpl-1', 'user-1', { name: 'Updated' })).rejects.toMatchObject({
      statusCode: 403,
      message: 'Cannot modify system templates',
    });
  });

  it('updates and returns template with ISO dates', async () => {
    dbMock.query.boardTemplates.findFirst.mockResolvedValue(mockTemplate);
    const updated = { ...mockTemplate, name: 'Updated' };
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updated]),
        }),
      }),
    });

    const result = await updateTemplate('team-1', 'tmpl-1', 'user-1', { name: 'Updated' });

    expect(result.name).toBe('Updated');
    expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// deleteTemplate
// ---------------------------------------------------------------------------

describe('deleteTemplate', () => {
  it('throws 404 when template not found', async () => {
    dbMock.query.boardTemplates.findFirst.mockResolvedValue(null);

    await expect(deleteTemplate('team-1', 'tmpl-1', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Template not found',
    });
  });

  it('throws 403 when template is a system template', async () => {
    dbMock.query.boardTemplates.findFirst.mockResolvedValue({ ...mockTemplate, isSystem: true });

    await expect(deleteTemplate('team-1', 'tmpl-1', 'user-1')).rejects.toMatchObject({
      statusCode: 403,
      message: 'Cannot delete system templates',
    });
  });

  it('deletes non-system template', async () => {
    dbMock.query.boardTemplates.findFirst.mockResolvedValue(mockTemplate);
    dbMock.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    await deleteTemplate('team-1', 'tmpl-1', 'user-1');

    expect(dbMock.delete).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// createBoardFromTemplate
// ---------------------------------------------------------------------------

describe('createBoardFromTemplate', () => {
  it('throws 403 when user is not a team member', async () => {
    dbMock.query.teamMemberships.findFirst.mockResolvedValue(null);

    await expect(
      createBoardFromTemplate('team-1', 'user-1', { name: 'New Board', templateId: 'tmpl-1' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 404 when template not found', async () => {
    dbMock.query.boardTemplates.findFirst.mockResolvedValue(null);

    await expect(
      createBoardFromTemplate('team-1', 'user-1', { name: 'New Board', templateId: 'tmpl-x' }),
    ).rejects.toMatchObject({ statusCode: 404, message: 'Template not found' });
  });

  it('creates board from template via transaction and returns board', async () => {
    const templateWithCols = {
      ...mockTemplate,
      config: {
        columns: [{ name: 'To Do' }, { name: 'Done' }],
        swimlanes: [],
        labels: [{ name: 'Bug', color: '#ff0000' }],
      },
    };
    dbMock.query.boardTemplates.findFirst.mockResolvedValue(templateWithCols);

    const mockBoard = { id: 'board-new', teamId: 'team-1', name: 'New Board' };

    // tx.insert: first call returns board (with returning), rest return values-only
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

    const result = await createBoardFromTemplate('team-1', 'user-1', {
      name: 'New Board',
      templateId: 'tmpl-1',
    });

    expect(result).toEqual(mockBoard);
    expect(dbMock.transaction).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// saveAsTemplate
// ---------------------------------------------------------------------------

describe('saveAsTemplate', () => {
  it('throws 404 when board not found', async () => {
    dbMock.query.boards.findFirst.mockResolvedValue(null);

    await expect(saveAsTemplate('board-x', 'user-1', { name: 'My Template' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'Board not found',
    });
  });

  it('creates template from board structure and returns it', async () => {
    dbMock.query.boards.findFirst.mockResolvedValue({ id: 'board-1', teamId: 'team-1', name: 'Test Board' });
    dbMock.query.columns.findMany.mockResolvedValue([{ name: 'To Do', color: null, wipLimit: null }]);
    dbMock.query.swimlanes.findMany.mockResolvedValue([{ name: 'Default', isDefault: true }]);
    dbMock.query.labels.findMany.mockResolvedValue([{ name: 'Bug', color: '#ff0000' }]);
    dbMock.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockTemplate]),
      }),
    });

    const result = await saveAsTemplate('board-1', 'user-1', { name: 'My Template' });

    expect(result).toMatchObject({ id: 'tmpl-1', name: 'My Template' });
    expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(dbMock.insert).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// ensureSystemTemplates
// ---------------------------------------------------------------------------

describe('ensureSystemTemplates', () => {
  it('inserts missing system templates', async () => {
    // Only 1 of 3 exists — should insert the other 2
    dbMock.query.boardTemplates.findMany.mockResolvedValue([{ name: 'Kanban Basic' }]);
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    await ensureSystemTemplates();

    expect(dbMock.insert).toHaveBeenCalledTimes(2);
  });

  it('does not insert when all system templates already exist', async () => {
    dbMock.query.boardTemplates.findMany.mockResolvedValue([
      { name: 'Kanban Basic' },
      { name: 'Scrum Board' },
      { name: 'Bug Tracking' },
    ]);

    await ensureSystemTemplates();

    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});
