import { eq, and } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { AppError } from '../../middleware/error.js';
import { requireBoardAccess } from '../../middleware/boardAccess.js';
import type { CreateLabelInput, UpdateLabelInput } from '@trello-clone/shared';

export async function listLabels(boardId: string, userId: string) {
  await requireBoardAccess(boardId, userId, 'read');

  return db.query.labels.findMany({
    where: eq(schema.labels.boardId, boardId),
    orderBy: [schema.labels.createdAt],
  });
}

export async function createLabel(boardId: string, userId: string, input: CreateLabelInput) {
  await requireBoardAccess(boardId, userId, 'edit');

  try {
    const [label] = await db
      .insert(schema.labels)
      .values({
        boardId,
        name: input.name,
        color: input.color,
      })
      .returning();

    return label;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      throw new AppError(409, 'A label with this name already exists on this board');
    }
    throw err;
  }
}

export async function updateLabel(boardId: string, labelId: string, userId: string, input: UpdateLabelInput) {
  await requireBoardAccess(boardId, userId, 'edit');

  const label = await db.query.labels.findFirst({
    where: and(eq(schema.labels.id, labelId), eq(schema.labels.boardId, boardId)),
  });
  if (!label) throw new AppError(404, 'Label not found');

  try {
    const [updated] = await db
      .update(schema.labels)
      .set(input)
      .where(eq(schema.labels.id, labelId))
      .returning();

    return updated;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      throw new AppError(409, 'A label with this name already exists on this board');
    }
    throw err;
  }
}

export async function deleteLabel(boardId: string, labelId: string, userId: string) {
  await requireBoardAccess(boardId, userId, 'edit');

  const label = await db.query.labels.findFirst({
    where: and(eq(schema.labels.id, labelId), eq(schema.labels.boardId, boardId)),
  });
  if (!label) throw new AppError(404, 'Label not found');

  await db.delete(schema.labels).where(eq(schema.labels.id, labelId));
}

export async function addCardLabel(boardId: string, cardId: string, userId: string, labelId: string) {
  const card = await db.query.cards.findFirst({
    where: eq(schema.cards.id, cardId),
  });
  if (!card || card.boardId !== boardId) throw new AppError(404, 'Card not found');

  await requireBoardAccess(boardId, userId, 'edit');

  // Verify label belongs to same board
  const label = await db.query.labels.findFirst({
    where: and(eq(schema.labels.id, labelId), eq(schema.labels.boardId, boardId)),
  });
  if (!label) throw new AppError(404, 'Label not found on this board');

  try {
    await db.insert(schema.cardLabels).values({ cardId, labelId });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      throw new AppError(409, 'Label already assigned to this card');
    }
    throw err;
  }

  return { label: { id: label.id, name: label.name, color: label.color } };
}

export async function removeCardLabel(boardId: string, cardId: string, userId: string, labelId: string) {
  const card = await db.query.cards.findFirst({
    where: eq(schema.cards.id, cardId),
  });
  if (!card || card.boardId !== boardId) throw new AppError(404, 'Card not found');

  await requireBoardAccess(boardId, userId, 'edit');

  await db
    .delete(schema.cardLabels)
    .where(and(eq(schema.cardLabels.cardId, cardId), eq(schema.cardLabels.labelId, labelId)));
}
