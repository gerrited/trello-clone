import { eq, and, asc } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { AppError } from '../../middleware/error.js';
import { getPositionAfter, getPositionBetween, getPositionBefore } from '../../utils/ordering.js';
import type { CreateColumnInput, UpdateColumnInput } from '@trello-clone/shared';

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

export async function createColumn(boardId: string, userId: string, input: CreateColumnInput) {
  await requireBoardAccess(boardId, userId);

  const existingColumns = await db.query.columns.findMany({
    where: eq(schema.columns.boardId, boardId),
    orderBy: [asc(schema.columns.position)],
    columns: { position: true },
  });

  const lastPos = existingColumns.length > 0
    ? existingColumns[existingColumns.length - 1].position
    : null;

  const [column] = await db
    .insert(schema.columns)
    .values({
      boardId,
      name: input.name,
      position: getPositionAfter(lastPos),
      color: input.color ?? null,
      wipLimit: input.wipLimit ?? null,
    })
    .returning();

  return column;
}

export async function updateColumn(columnId: string, userId: string, input: UpdateColumnInput) {
  const column = await db.query.columns.findFirst({
    where: eq(schema.columns.id, columnId),
  });
  if (!column) throw new AppError(404, 'Column not found');

  await requireBoardAccess(column.boardId, userId);

  const [updated] = await db
    .update(schema.columns)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.columns.id, columnId))
    .returning();

  return updated;
}

export async function moveColumn(columnId: string, userId: string, afterId: string | null) {
  const column = await db.query.columns.findFirst({
    where: eq(schema.columns.id, columnId),
  });
  if (!column) throw new AppError(404, 'Column not found');

  await requireBoardAccess(column.boardId, userId);

  const allColumns = await db.query.columns.findMany({
    where: eq(schema.columns.boardId, column.boardId),
    orderBy: [asc(schema.columns.position)],
  });

  let newPosition: string;

  if (afterId === null) {
    // Move to beginning
    newPosition = getPositionBefore(allColumns[0]?.position ?? null);
  } else {
    const afterIndex = allColumns.findIndex((c) => c.id === afterId);
    if (afterIndex === -1) throw new AppError(404, 'Target column not found');

    const afterPos = allColumns[afterIndex].position;
    const nextColumn = allColumns.slice(afterIndex + 1).find((c) => c.id !== columnId);
    const beforePos = nextColumn?.position ?? null;

    newPosition = getPositionBetween(afterPos, beforePos);
  }

  const [updated] = await db
    .update(schema.columns)
    .set({ position: newPosition, updatedAt: new Date() })
    .where(eq(schema.columns.id, columnId))
    .returning();

  return updated;
}

export async function deleteColumn(columnId: string, userId: string) {
  const column = await db.query.columns.findFirst({
    where: eq(schema.columns.id, columnId),
  });
  if (!column) throw new AppError(404, 'Column not found');

  await requireBoardAccess(column.boardId, userId);

  const cardInColumn = await db.query.cards.findFirst({
    where: eq(schema.cards.columnId, columnId),
  });

  if (cardInColumn) {
    throw new AppError(400, 'Cannot delete column that contains cards');
  }

  await db.delete(schema.columns).where(eq(schema.columns.id, columnId));
}
