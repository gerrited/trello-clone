import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@trello-clone/shared', () => ({
  WS_EVENTS: {
    ACTIVITY_CREATED: 'activity:created',
    NOTIFICATION_NEW: 'notification:new',
  },
}));

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
      users: { findFirst: vi.fn() },
      boards: { findFirst: vi.fn() },
      teamMemberships: { findMany: vi.fn() },
      activities: { findMany: vi.fn() },
      notifications: { findFirst: vi.fn(), findMany: vi.fn() },
      cards: { findFirst: vi.fn() },
    },
    insert: vi.fn(),
    update: vi.fn(),
  },
  schema: await import('../../db/schema.js'),
}));

vi.mock('../../middleware/boardAccess.js', () => ({
  requireBoardAccess: vi.fn().mockResolvedValue({ board: { id: 'board-1' }, permission: 'read' }),
}));

vi.mock('../../ws/emitters.js', () => ({
  broadcastToBoard: vi.fn(),
  emitToUser: vi.fn(),
}));

import { db } from '../../db/index.js';
import { requireBoardAccess } from '../../middleware/boardAccess.js';
import { broadcastToBoard, emitToUser } from '../../ws/emitters.js';
import {
  logActivity,
  listBoardActivities,
  listCardActivities,
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from './activities.service.js';

type MockedDb = {
  query: {
    users: { findFirst: ReturnType<typeof vi.fn> };
    boards: { findFirst: ReturnType<typeof vi.fn> };
    teamMemberships: { findMany: ReturnType<typeof vi.fn> };
    activities: { findMany: ReturnType<typeof vi.fn> };
    notifications: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    cards: { findFirst: ReturnType<typeof vi.fn> };
  };
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

const dbMock = db as unknown as MockedDb;

const createdAt = new Date('2024-01-01T00:00:00.000Z');

const mockUser = { id: 'user-1', displayName: 'Test User', avatarUrl: null };

const insertedActivity = {
  id: 'act-1',
  boardId: 'board-1',
  userId: 'user-1',
  action: 'card.created',
  entityType: 'card',
  entityId: 'card-1',
  cardId: null,
  metadata: null,
  createdAt,
};

const mockActivityRow = {
  id: 'act-1',
  boardId: 'board-1',
  cardId: null,
  userId: 'user-1',
  action: 'card.created',
  entityType: 'card',
  entityId: 'card-1',
  metadata: '{"title":"Test"}',
  createdAt,
  user: mockUser,
};

const mockNotifRow = {
  id: 'notif-1',
  activityId: 'act-1',
  isRead: false,
  createdAt,
  activity: {
    id: 'act-1',
    boardId: 'board-1',
    cardId: null,
    userId: 'user-1',
    action: 'card.created',
    entityType: 'card',
    entityId: 'card-1',
    metadata: '{"title":"Test"}',
    createdAt,
    user: mockUser,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (requireBoardAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
    board: { id: 'board-1' },
    permission: 'read',
  });
});

// ---------------------------------------------------------------------------
// logActivity
// ---------------------------------------------------------------------------

describe('logActivity', () => {
  const logInput = {
    boardId: 'board-1',
    userId: 'user-1',
    action: 'card.created' as const,
    entityType: 'card',
    entityId: 'card-1',
  };

  it('inserts activity and broadcasts to board', async () => {
    // First insert: activity
    dbMock.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([insertedActivity]),
      }),
    });
    dbMock.query.users.findFirst.mockResolvedValue(mockUser);
    dbMock.query.boards.findFirst.mockResolvedValue({ teamId: 'team-1' });
    dbMock.query.teamMemberships.findMany.mockResolvedValue([{ userId: 'user-1' }]);

    await logActivity(logInput);

    expect(dbMock.insert).toHaveBeenCalledOnce();
    expect(broadcastToBoard).toHaveBeenCalledOnce();
  });

  it('creates notifications for other team members and emits via WS', async () => {
    dbMock.insert
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([insertedActivity]),
        }),
      })
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: 'notif-1', userId: 'user-2', activityId: 'act-1', isRead: false, createdAt },
          ]),
        }),
      });
    dbMock.query.users.findFirst.mockResolvedValue(mockUser);
    dbMock.query.boards.findFirst.mockResolvedValue({ teamId: 'team-1' });
    dbMock.query.teamMemberships.findMany.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ]);

    await logActivity(logInput);

    // Two inserts: activity + notifications
    expect(dbMock.insert).toHaveBeenCalledTimes(2);
    expect(emitToUser).toHaveBeenCalledOnce();
  });

  it('skips notifications when board not found', async () => {
    dbMock.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([insertedActivity]),
      }),
    });
    dbMock.query.users.findFirst.mockResolvedValue(mockUser);
    dbMock.query.boards.findFirst.mockResolvedValue(null);

    await logActivity(logInput);

    expect(broadcastToBoard).toHaveBeenCalledOnce();
    expect(dbMock.insert).toHaveBeenCalledOnce(); // Only activity insert, no notifications
  });

  it('does not throw on error (fire-and-forget)', async () => {
    dbMock.insert.mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(new Error('DB down')),
      }),
    });

    // Should not throw
    await expect(logActivity(logInput)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// listBoardActivities
// ---------------------------------------------------------------------------

describe('listBoardActivities', () => {
  it('calls requireBoardAccess with "read"', async () => {
    dbMock.query.activities.findMany.mockResolvedValue([]);

    await listBoardActivities('board-1', 'user-1');

    expect(requireBoardAccess).toHaveBeenCalledWith('board-1', 'user-1', 'read');
  });

  it('returns activities with parsed metadata and ISO dates', async () => {
    dbMock.query.activities.findMany.mockResolvedValue([mockActivityRow]);

    const result = await listBoardActivities('board-1', 'user-1');

    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].metadata).toEqual({ title: 'Test' });
    expect(result.activities[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(result.nextCursor).toBeNull();
  });

  it('returns empty metadata object when metadata is null', async () => {
    dbMock.query.activities.findMany.mockResolvedValue([{ ...mockActivityRow, metadata: null }]);

    const result = await listBoardActivities('board-1', 'user-1');

    expect(result.activities[0].metadata).toEqual({});
  });

  it('returns hasMore and nextCursor when results exceed limit', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      ...mockActivityRow,
      id: `act-${i}`,
      createdAt: new Date(`2024-01-${String(21 - i).padStart(2, '0')}T00:00:00.000Z`),
    }));
    dbMock.query.activities.findMany.mockResolvedValue(rows);

    const result = await listBoardActivities('board-1', 'user-1', undefined, 20);

    expect(result.activities).toHaveLength(20);
    expect(result.nextCursor).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listCardActivities
// ---------------------------------------------------------------------------

describe('listCardActivities', () => {
  it('throws 404 when card not found', async () => {
    dbMock.query.cards.findFirst.mockResolvedValue(null);

    await expect(listCardActivities('card-1', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Card not found',
    });
  });

  it('calls requireBoardAccess with the card\'s boardId', async () => {
    dbMock.query.cards.findFirst.mockResolvedValue({ boardId: 'board-1' });
    dbMock.query.activities.findMany.mockResolvedValue([]);

    await listCardActivities('card-1', 'user-1');

    expect(requireBoardAccess).toHaveBeenCalledWith('board-1', 'user-1', 'read');
  });

  it('returns card activities', async () => {
    dbMock.query.cards.findFirst.mockResolvedValue({ boardId: 'board-1' });
    dbMock.query.activities.findMany.mockResolvedValue([mockActivityRow]);

    const result = await listCardActivities('card-1', 'user-1');

    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].id).toBe('act-1');
  });
});

// ---------------------------------------------------------------------------
// listNotifications
// ---------------------------------------------------------------------------

describe('listNotifications', () => {
  it('returns notifications with nested activity and user', async () => {
    dbMock.query.notifications.findMany.mockResolvedValue([mockNotifRow]);

    const result = await listNotifications('user-1');

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(result.notifications[0].activity.user).toEqual(mockUser);
    expect(result.nextCursor).toBeNull();
  });

  it('returns hasMore and nextCursor when results exceed limit', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      ...mockNotifRow,
      id: `notif-${i}`,
      createdAt: new Date(`2024-01-${String(3 - i).padStart(2, '0')}T00:00:00.000Z`),
    }));
    dbMock.query.notifications.findMany.mockResolvedValue(rows);

    const result = await listNotifications('user-1', false, undefined, 2);

    expect(result.notifications).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getUnreadCount
// ---------------------------------------------------------------------------

describe('getUnreadCount', () => {
  it('returns count of unread notifications', async () => {
    dbMock.query.notifications.findMany.mockResolvedValue([
      { id: 'n1' },
      { id: 'n2' },
      { id: 'n3' },
    ]);

    const count = await getUnreadCount('user-1');

    expect(count).toBe(3);
  });

  it('returns 0 when no unread notifications', async () => {
    dbMock.query.notifications.findMany.mockResolvedValue([]);

    const count = await getUnreadCount('user-1');

    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// markAsRead
// ---------------------------------------------------------------------------

describe('markAsRead', () => {
  it('throws 404 when notification not found', async () => {
    dbMock.query.notifications.findFirst.mockResolvedValue(null);

    await expect(markAsRead('notif-x', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Notification not found',
    });
  });

  it('marks notification as read', async () => {
    dbMock.query.notifications.findFirst.mockResolvedValue({ id: 'notif-1', userId: 'user-1' });
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await markAsRead('notif-1', 'user-1');

    expect(dbMock.update).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// markAllAsRead
// ---------------------------------------------------------------------------

describe('markAllAsRead', () => {
  it('updates all unread notifications for the user', async () => {
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await markAllAsRead('user-1');

    expect(dbMock.update).toHaveBeenCalledOnce();
  });
});
