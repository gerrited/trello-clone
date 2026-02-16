import { eq, and, asc, sql, inArray } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { AppError } from '../../middleware/error.js';
import { getPositionAfter } from '../../utils/ordering.js';
import type { CreateBoardInput, UpdateBoardInput } from '@trello-clone/shared';

async function requireTeamMember(teamId: string, userId: string) {
  const membership = await db.query.teamMemberships.findFirst({
    where: and(
      eq(schema.teamMemberships.teamId, teamId),
      eq(schema.teamMemberships.userId, userId),
    ),
  });
  if (!membership) {
    throw new AppError(403, 'Not a member of this team');
  }
  return membership;
}

export async function createBoard(teamId: string, userId: string, input: CreateBoardInput) {
  await requireTeamMember(teamId, userId);

  return await db.transaction(async (tx) => {
    const [board] = await tx
      .insert(schema.boards)
      .values({
        teamId,
        name: input.name,
        description: input.description ?? null,
        createdBy: userId,
      })
      .returning();

    // Create default swimlane
    await tx.insert(schema.swimlanes).values({
      boardId: board.id,
      name: 'Default',
      position: getPositionAfter(null),
      isDefault: true,
    });

    // Create starter columns
    let pos: string | null = null;
    for (const name of ['To Do', 'In Progress', 'Done']) {
      pos = getPositionAfter(pos);
      await tx.insert(schema.columns).values({
        boardId: board.id,
        name,
        position: pos,
      });
    }

    return board;
  });
}

export async function listBoards(teamId: string, userId: string) {
  await requireTeamMember(teamId, userId);

  return db.query.boards.findMany({
    where: and(eq(schema.boards.teamId, teamId), eq(schema.boards.isArchived, false)),
    orderBy: [asc(schema.boards.createdAt)],
  });
}

export async function getBoard(boardId: string, userId: string) {
  const board = await db.query.boards.findFirst({
    where: eq(schema.boards.id, boardId),
  });

  if (!board) {
    throw new AppError(404, 'Board not found');
  }

  await requireTeamMember(board.teamId, userId);

  const [columnsResult, swimlanesResult, cardsResult] = await Promise.all([
    db.query.columns.findMany({
      where: eq(schema.columns.boardId, boardId),
      orderBy: [asc(schema.columns.position)],
    }),
    db.query.swimlanes.findMany({
      where: eq(schema.swimlanes.boardId, boardId),
      orderBy: [asc(schema.swimlanes.position)],
    }),
    db.query.cards.findMany({
      where: and(eq(schema.cards.boardId, boardId), eq(schema.cards.isArchived, false)),
      orderBy: [asc(schema.cards.position)],
      with: {
        assignees: {
          with: {
            user: {
              columns: { id: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    }),
  ]);

  // Compute comment counts per card (single SQL query)
  const cardIds = cardsResult.map((c) => c.id);
  const commentCounts: Record<string, number> = {};
  if (cardIds.length > 0) {
    const counts = await db
      .select({
        cardId: schema.comments.cardId,
        count: sql<number>`count(*)::int`.as('count'),
      })
      .from(schema.comments)
      .where(inArray(schema.comments.cardId, cardIds))
      .groupBy(schema.comments.cardId);

    for (const row of counts) {
      commentCounts[row.cardId] = row.count;
    }
  }

  // Compute subtask counts from the card array (in-memory)
  const lastColumn = columnsResult.length > 0 ? columnsResult[columnsResult.length - 1] : null;
  const subtaskCounts: Record<string, { total: number; done: number }> = {};
  for (const card of cardsResult) {
    if (card.parentCardId) {
      if (!subtaskCounts[card.parentCardId]) {
        subtaskCounts[card.parentCardId] = { total: 0, done: 0 };
      }
      subtaskCounts[card.parentCardId].total++;
      if (lastColumn && card.columnId === lastColumn.id) {
        subtaskCounts[card.parentCardId].done++;
      }
    }
  }

  const cardSummaries = cardsResult.map((card) => ({
    id: card.id,
    columnId: card.columnId,
    swimlaneId: card.swimlaneId,
    parentCardId: card.parentCardId,
    cardType: card.cardType,
    title: card.title,
    position: card.position,
    assignees: card.assignees.map((a) => ({
      id: a.user.id,
      displayName: a.user.displayName,
      avatarUrl: a.user.avatarUrl,
    })),
    commentCount: commentCounts[card.id] ?? 0,
    subtaskCount: subtaskCounts[card.id]?.total ?? 0,
    subtaskDoneCount: subtaskCounts[card.id]?.done ?? 0,
  }));

  return {
    ...board,
    columns: columnsResult,
    swimlanes: swimlanesResult,
    cards: cardSummaries,
  };
}

export async function updateBoard(boardId: string, userId: string, input: UpdateBoardInput) {
  const board = await db.query.boards.findFirst({
    where: eq(schema.boards.id, boardId),
  });

  if (!board) {
    throw new AppError(404, 'Board not found');
  }

  await requireTeamMember(board.teamId, userId);

  const [updated] = await db
    .update(schema.boards)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.boards.id, boardId))
    .returning();

  return updated;
}

export async function deleteBoard(boardId: string, userId: string) {
  const board = await db.query.boards.findFirst({
    where: eq(schema.boards.id, boardId),
  });

  if (!board) {
    throw new AppError(404, 'Board not found');
  }

  await requireTeamMember(board.teamId, userId);

  await db.delete(schema.boards).where(eq(schema.boards.id, boardId));
}
