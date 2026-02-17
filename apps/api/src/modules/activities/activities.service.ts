import { eq, and, desc, lt } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { AppError } from '../../middleware/error.js';
import type { ActivityAction } from '@trello-clone/shared';
import { broadcastToBoard, emitToUser } from '../../ws/emitters.js';
import { WS_EVENTS } from '@trello-clone/shared';

interface LogActivityInput {
  boardId: string;
  userId: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  cardId?: string | null;
  metadata?: Record<string, unknown>;
  excludeSocketId?: string;
}

/**
 * Log an activity and create notifications for team members.
 * This is a fire-and-forget operation — it does NOT block the response.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const [activity] = await db
      .insert(schema.activities)
      .values({
        boardId: input.boardId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        cardId: input.cardId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      })
      .returning();

    // Fetch the user info for the activity
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, input.userId),
      columns: { id: true, displayName: true, avatarUrl: true },
    });

    const fullActivity = {
      ...activity,
      createdAt: activity.createdAt.toISOString(),
      metadata: input.metadata ?? {},
      user: user
        ? { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl }
        : { id: input.userId, displayName: 'Unknown', avatarUrl: null },
    };

    // Broadcast activity to board room
    broadcastToBoard(input.boardId, WS_EVENTS.ACTIVITY_CREATED, { activity: fullActivity }, input.excludeSocketId);

    // Find team members for notifications (exclude the actor)
    const board = await db.query.boards.findFirst({
      where: eq(schema.boards.id, input.boardId),
      columns: { teamId: true },
    });

    if (!board) return;

    const members = await db.query.teamMemberships.findMany({
      where: eq(schema.teamMemberships.teamId, board.teamId),
      columns: { userId: true },
    });

    const recipientIds = members
      .map((m) => m.userId)
      .filter((id) => id !== input.userId);

    if (recipientIds.length === 0) return;

    // Create notifications for all recipients
    const notifValues = recipientIds.map((userId) => ({
      userId,
      activityId: activity.id,
    }));

    const insertedNotifs = await db
      .insert(schema.notifications)
      .values(notifValues)
      .returning();

    // Push notification to each user via Socket.IO
    for (const notif of insertedNotifs) {
      const notification = {
        id: notif.id,
        activityId: notif.activityId,
        isRead: notif.isRead,
        createdAt: notif.createdAt.toISOString(),
        activity: fullActivity,
      };
      emitToUser(notif.userId, WS_EVENTS.NOTIFICATION_NEW, { notification });
    }
  } catch (err) {
    // Log but don't throw — activity logging should never break the main flow
    console.error('Failed to log activity:', err);
  }
}

/**
 * List activities for a board (cursor-based pagination).
 */
export async function listBoardActivities(
  boardId: string,
  userId: string,
  cursor?: string,
  limit = 20,
) {
  // Verify board access
  const board = await db.query.boards.findFirst({
    where: eq(schema.boards.id, boardId),
    columns: { teamId: true },
  });

  if (!board) throw new AppError(404, 'Board not found');

  const membership = await db.query.teamMemberships.findFirst({
    where: and(
      eq(schema.teamMemberships.teamId, board.teamId),
      eq(schema.teamMemberships.userId, userId),
    ),
  });

  if (!membership) throw new AppError(403, 'Not a member of this team');

  const conditions = [eq(schema.activities.boardId, boardId)];
  if (cursor) {
    conditions.push(lt(schema.activities.createdAt, new Date(cursor)));
  }

  const rows = await db.query.activities.findMany({
    where: and(...conditions),
    orderBy: [desc(schema.activities.createdAt)],
    limit: limit + 1,
    with: {
      user: {
        columns: { id: true, displayName: true, avatarUrl: true },
      },
    },
  });

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  return {
    activities: items.map((a) => ({
      id: a.id,
      boardId: a.boardId,
      cardId: a.cardId,
      userId: a.userId,
      action: a.action as ActivityAction,
      entityType: a.entityType,
      entityId: a.entityId,
      metadata: a.metadata ? JSON.parse(a.metadata) : {},
      createdAt: a.createdAt.toISOString(),
      user: {
        id: a.user.id,
        displayName: a.user.displayName,
        avatarUrl: a.user.avatarUrl,
      },
    })),
    nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null,
  };
}

/**
 * List activities for a specific card.
 */
export async function listCardActivities(
  cardId: string,
  userId: string,
  cursor?: string,
  limit = 20,
) {
  // Verify card access via board
  const card = await db.query.cards.findFirst({
    where: eq(schema.cards.id, cardId),
    columns: { boardId: true },
  });

  if (!card) throw new AppError(404, 'Card not found');

  // Verify team membership
  const board = await db.query.boards.findFirst({
    where: eq(schema.boards.id, card.boardId),
    columns: { teamId: true },
  });

  if (!board) throw new AppError(404, 'Board not found');

  const membership = await db.query.teamMemberships.findFirst({
    where: and(
      eq(schema.teamMemberships.teamId, board.teamId),
      eq(schema.teamMemberships.userId, userId),
    ),
  });

  if (!membership) throw new AppError(403, 'Not a member of this team');

  // Query card-specific activities
  const conditions = [eq(schema.activities.cardId, cardId)];
  if (cursor) {
    conditions.push(lt(schema.activities.createdAt, new Date(cursor)));
  }

  const rows = await db.query.activities.findMany({
    where: and(...conditions),
    orderBy: [desc(schema.activities.createdAt)],
    limit: limit + 1,
    with: {
      user: {
        columns: { id: true, displayName: true, avatarUrl: true },
      },
    },
  });

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  return {
    activities: items.map((a) => ({
      id: a.id,
      boardId: a.boardId,
      cardId: a.cardId,
      userId: a.userId,
      action: a.action as ActivityAction,
      entityType: a.entityType,
      entityId: a.entityId,
      metadata: a.metadata ? JSON.parse(a.metadata) : {},
      createdAt: a.createdAt.toISOString(),
      user: {
        id: a.user.id,
        displayName: a.user.displayName,
        avatarUrl: a.user.avatarUrl,
      },
    })),
    nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null,
  };
}

/**
 * List notifications for a user (cursor-based pagination).
 */
export async function listNotifications(
  userId: string,
  unreadOnly = false,
  cursor?: string,
  limit = 20,
) {
  const conditions = [eq(schema.notifications.userId, userId)];
  if (unreadOnly) {
    conditions.push(eq(schema.notifications.isRead, false));
  }
  if (cursor) {
    conditions.push(lt(schema.notifications.createdAt, new Date(cursor)));
  }

  const rows = await db.query.notifications.findMany({
    where: and(...conditions),
    orderBy: [desc(schema.notifications.createdAt)],
    limit: limit + 1,
    with: {
      activity: {
        with: {
          user: {
            columns: { id: true, displayName: true, avatarUrl: true },
          },
        },
      },
    },
  });

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  return {
    notifications: items.map((n) => ({
      id: n.id,
      activityId: n.activityId,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
      activity: {
        id: n.activity.id,
        boardId: n.activity.boardId,
        cardId: n.activity.cardId,
        userId: n.activity.userId,
        action: n.activity.action as ActivityAction,
        entityType: n.activity.entityType,
        entityId: n.activity.entityId,
        metadata: n.activity.metadata ? JSON.parse(n.activity.metadata) : {},
        createdAt: n.activity.createdAt.toISOString(),
        user: {
          id: n.activity.user.id,
          displayName: n.activity.user.displayName,
          avatarUrl: n.activity.user.avatarUrl,
        },
      },
    })),
    nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null,
  };
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userId: string) {
  const rows = await db.query.notifications.findMany({
    where: and(
      eq(schema.notifications.userId, userId),
      eq(schema.notifications.isRead, false),
    ),
    columns: { id: true },
  });
  return rows.length;
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(notificationId: string, userId: string) {
  const notif = await db.query.notifications.findFirst({
    where: and(
      eq(schema.notifications.id, notificationId),
      eq(schema.notifications.userId, userId),
    ),
  });

  if (!notif) throw new AppError(404, 'Notification not found');

  await db
    .update(schema.notifications)
    .set({ isRead: true })
    .where(eq(schema.notifications.id, notificationId));
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(userId: string) {
  await db
    .update(schema.notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.isRead, false),
      ),
    );
}
