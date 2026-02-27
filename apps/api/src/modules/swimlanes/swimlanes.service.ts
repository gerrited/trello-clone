import { eq, asc } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { AppError } from '../../middleware/error.js';
import { requireBoardAccess } from '../../middleware/boardAccess.js';
import { getPositionAfter, getPositionBetween, getPositionBefore } from '../../utils/ordering.js';
import type { CreateSwimlaneInput, UpdateSwimlaneInput } from '@trello-clone/shared';

export async function createSwimlane(boardId: string, userId: string, input: CreateSwimlaneInput) {
  await requireBoardAccess(boardId, userId, 'edit');

  const existingSwimlanes = await db.query.swimlanes.findMany({
    where: eq(schema.swimlanes.boardId, boardId),
    orderBy: [asc(schema.swimlanes.position)],
    columns: { position: true },
  });

  const lastPos = existingSwimlanes.length > 0
    ? existingSwimlanes[existingSwimlanes.length - 1].position
    : null;

  const [swimlane] = await db
    .insert(schema.swimlanes)
    .values({
      boardId,
      name: input.name,
      position: getPositionAfter(lastPos),
    })
    .returning();

  return swimlane;
}

export async function updateSwimlane(swimlaneId: string, userId: string, input: UpdateSwimlaneInput) {
  const swimlane = await db.query.swimlanes.findFirst({
    where: eq(schema.swimlanes.id, swimlaneId),
  });
  if (!swimlane) throw new AppError(404, 'Swimlane not found');

  await requireBoardAccess(swimlane.boardId, userId, 'edit');

  const [updated] = await db
    .update(schema.swimlanes)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.swimlanes.id, swimlaneId))
    .returning();

  return updated;
}

export async function moveSwimlane(swimlaneId: string, userId: string, afterId: string | null) {
  const swimlane = await db.query.swimlanes.findFirst({
    where: eq(schema.swimlanes.id, swimlaneId),
  });
  if (!swimlane) throw new AppError(404, 'Swimlane not found');

  await requireBoardAccess(swimlane.boardId, userId, 'edit');

  const allSwimlanes = await db.query.swimlanes.findMany({
    where: eq(schema.swimlanes.boardId, swimlane.boardId),
    orderBy: [asc(schema.swimlanes.position)],
  });

  let newPosition: string;

  if (afterId === null) {
    // Move to beginning
    newPosition = getPositionBefore(allSwimlanes[0]?.position ?? null);
  } else {
    const afterIndex = allSwimlanes.findIndex((s) => s.id === afterId);
    if (afterIndex === -1) throw new AppError(404, 'Target swimlane not found');

    const afterPos = allSwimlanes[afterIndex].position;
    const nextSwimlane = allSwimlanes.slice(afterIndex + 1).find((s) => s.id !== swimlaneId);
    const beforePos = nextSwimlane?.position ?? null;

    newPosition = getPositionBetween(afterPos, beforePos);
  }

  const [updated] = await db
    .update(schema.swimlanes)
    .set({ position: newPosition, updatedAt: new Date() })
    .where(eq(schema.swimlanes.id, swimlaneId))
    .returning();

  return updated;
}

export async function deleteSwimlane(swimlaneId: string, userId: string) {
  const swimlane = await db.query.swimlanes.findFirst({
    where: eq(schema.swimlanes.id, swimlaneId),
  });
  if (!swimlane) throw new AppError(404, 'Swimlane not found');

  await requireBoardAccess(swimlane.boardId, userId, 'edit');

  if (swimlane.isDefault === true) {
    throw new AppError(400, 'Cannot delete the default swimlane');
  }

  const cardInSwimlane = await db.query.cards.findFirst({
    where: eq(schema.cards.swimlaneId, swimlaneId),
  });

  if (cardInSwimlane) {
    throw new AppError(400, 'Cannot delete swimlane that contains cards');
  }

  await db.delete(schema.swimlanes).where(eq(schema.swimlanes.id, swimlaneId));
}
