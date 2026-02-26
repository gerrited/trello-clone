import { eq, asc } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { AppError } from '../../middleware/error.js';
import { requireBoardAccess } from '../../middleware/boardAccess.js';
import type { CreateCommentInput, UpdateCommentInput } from '@trello-clone/shared';

async function requireCardOnBoard(cardId: string, boardId: string) {
  const card = await db.query.cards.findFirst({
    where: eq(schema.cards.id, cardId),
  });
  if (!card || card.boardId !== boardId) throw new AppError(404, 'Card not found');
  return card;
}

export async function listComments(boardId: string, cardId: string, userId: string) {
  await requireBoardAccess(boardId, userId, 'read');
  await requireCardOnBoard(cardId, boardId);

  return db.query.comments.findMany({
    where: eq(schema.comments.cardId, cardId),
    orderBy: [asc(schema.comments.createdAt)],
    with: {
      author: {
        columns: { id: true, displayName: true, avatarUrl: true },
      },
    },
  });
}

export async function createComment(boardId: string, cardId: string, userId: string, input: CreateCommentInput) {
  await requireBoardAccess(boardId, userId, 'comment');
  await requireCardOnBoard(cardId, boardId);

  const [comment] = await db
    .insert(schema.comments)
    .values({
      cardId,
      authorId: userId,
      body: input.body,
    })
    .returning();

  const full = await db.query.comments.findFirst({
    where: eq(schema.comments.id, comment.id),
    with: {
      author: {
        columns: { id: true, displayName: true, avatarUrl: true },
      },
    },
  });

  return full!;
}

export async function updateComment(
  boardId: string,
  cardId: string,
  commentId: string,
  userId: string,
  input: UpdateCommentInput,
) {
  await requireBoardAccess(boardId, userId, 'comment');
  await requireCardOnBoard(cardId, boardId);

  const comment = await db.query.comments.findFirst({
    where: eq(schema.comments.id, commentId),
  });
  if (!comment || comment.cardId !== cardId) throw new AppError(404, 'Comment not found');
  if (comment.authorId !== userId) throw new AppError(403, 'Only the author can edit this comment');

  const [updated] = await db
    .update(schema.comments)
    .set({ body: input.body, updatedAt: new Date() })
    .where(eq(schema.comments.id, commentId))
    .returning();

  const full = await db.query.comments.findFirst({
    where: eq(schema.comments.id, updated.id),
    with: {
      author: {
        columns: { id: true, displayName: true, avatarUrl: true },
      },
    },
  });

  return full!;
}

export async function deleteComment(
  boardId: string,
  cardId: string,
  commentId: string,
  userId: string,
) {
  await requireBoardAccess(boardId, userId, 'comment');
  await requireCardOnBoard(cardId, boardId);

  const comment = await db.query.comments.findFirst({
    where: eq(schema.comments.id, commentId),
  });
  if (!comment || comment.cardId !== cardId) throw new AppError(404, 'Comment not found');
  if (comment.authorId !== userId) throw new AppError(403, 'Only the author can delete this comment');

  await db.delete(schema.comments).where(eq(schema.comments.id, commentId));
}
