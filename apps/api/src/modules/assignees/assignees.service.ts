import { eq, and } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { AppError } from '../../middleware/error.js';
import type { AddAssigneeInput } from '@trello-clone/shared';

async function requireBoardAccess(boardId: string, userId: string) {
  const board = await db.query.boards.findFirst({
    where: eq(schema.boards.id, boardId),
  });
  if (!board) throw new AppError(404, 'Board not found');

  const membership = await db.query.teamMemberships.findFirst({
    where: and(
      eq(schema.teamMemberships.teamId, board.teamId),
      eq(schema.teamMemberships.userId, userId),
    ),
  });
  if (!membership) throw new AppError(403, 'Not a member of this team');

  return board;
}

export async function addAssignee(boardId: string, cardId: string, userId: string, input: AddAssigneeInput) {
  const card = await db.query.cards.findFirst({
    where: eq(schema.cards.id, cardId),
  });
  if (!card || card.boardId !== boardId) throw new AppError(404, 'Card not found');

  const board = await requireBoardAccess(boardId, userId);

  // Verify the target user is a team member
  const targetMembership = await db.query.teamMemberships.findFirst({
    where: and(
      eq(schema.teamMemberships.teamId, board.teamId),
      eq(schema.teamMemberships.userId, input.userId),
    ),
  });
  if (!targetMembership) throw new AppError(400, 'User is not a member of this team');

  try {
    await db.insert(schema.cardAssignees).values({ cardId, userId: input.userId });
  } catch (err: any) {
    if (err?.code === '23505') {
      throw new AppError(409, 'User already assigned to this card');
    }
    throw err;
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, input.userId),
    columns: { id: true, displayName: true, avatarUrl: true },
  });

  return { assignee: user };
}

export async function removeAssignee(boardId: string, cardId: string, userId: string, targetUserId: string) {
  const card = await db.query.cards.findFirst({
    where: eq(schema.cards.id, cardId),
  });
  if (!card || card.boardId !== boardId) throw new AppError(404, 'Card not found');

  await requireBoardAccess(boardId, userId);

  await db
    .delete(schema.cardAssignees)
    .where(and(eq(schema.cardAssignees.cardId, cardId), eq(schema.cardAssignees.userId, targetUserId)));
}

export async function listAssignees(boardId: string, cardId: string, userId: string) {
  const card = await db.query.cards.findFirst({
    where: eq(schema.cards.id, cardId),
  });
  if (!card || card.boardId !== boardId) throw new AppError(404, 'Card not found');

  await requireBoardAccess(boardId, userId);

  const assignments = await db.query.cardAssignees.findMany({
    where: eq(schema.cardAssignees.cardId, cardId),
    with: {
      user: {
        columns: { id: true, displayName: true, avatarUrl: true },
      },
    },
  });

  return assignments.map((a) => ({
    id: a.user.id,
    displayName: a.user.displayName,
    avatarUrl: a.user.avatarUrl,
  }));
}
