import { and, eq, or, ilike, inArray, sql, desc } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { AppError } from '../../middleware/error.js';
import type { SearchInput } from '@trello-clone/shared';

export async function searchCards(userId: string, input: SearchInput) {
  const { q, teamId, boardId, labelId, type, hasDueDate, limit, offset } = input;

  // Step 1: Get all board IDs the user has access to
  let accessibleBoardIds: string[];

  if (boardId) {
    // Verify the user can access this specific board
    const board = await db.query.boards.findFirst({
      where: eq(schema.boards.id, boardId),
      columns: { id: true, teamId: true },
    });
    if (!board) throw new AppError(404, 'Board not found');

    const membership = await db.query.teamMemberships.findFirst({
      where: and(
        eq(schema.teamMemberships.teamId, board.teamId),
        eq(schema.teamMemberships.userId, userId),
      ),
    });
    if (!membership) throw new AppError(403, 'Access denied');
    accessibleBoardIds = [boardId];
  } else {
    // Get all teams the user belongs to
    const memberships = await db.query.teamMemberships.findMany({
      where: teamId
        ? and(
            eq(schema.teamMemberships.userId, userId),
            eq(schema.teamMemberships.teamId, teamId),
          )
        : eq(schema.teamMemberships.userId, userId),
      columns: { teamId: true },
    });
    const teamIds = memberships.map((m) => m.teamId);

    if (teamIds.length === 0) return { results: [], total: 0, hasMore: false };

    const boards = await db.query.boards.findMany({
      where: and(
        inArray(schema.boards.teamId, teamIds),
        eq(schema.boards.isArchived, false),
      ),
      columns: { id: true },
    });
    accessibleBoardIds = boards.map((b) => b.id);

    // Also include boards shared directly with the user
    const sharedBoards = await db.query.boardShares.findMany({
      where: eq(schema.boardShares.userId, userId),
      columns: { boardId: true },
    });
    for (const s of sharedBoards) {
      if (!accessibleBoardIds.includes(s.boardId)) accessibleBoardIds.push(s.boardId);
    }
  }

  if (accessibleBoardIds.length === 0) return { results: [], total: 0, hasMore: false };

  // Step 2: Build base conditions
  const conditions: ReturnType<typeof eq>[] = [
    inArray(schema.cards.boardId, accessibleBoardIds),
    eq(schema.cards.isArchived, false),
    or(
      ilike(schema.cards.title, `%${q}%`),
      ilike(schema.cards.description, `%${q}%`),
    )!,
  ];

  if (type) conditions.push(eq(schema.cards.cardType, type));
  if (hasDueDate === true) conditions.push(sql`${schema.cards.dueDate} IS NOT NULL` as any);
  if (hasDueDate === false) conditions.push(sql`${schema.cards.dueDate} IS NULL` as any);

  // Step 3: Handle labelId filter with subquery
  if (labelId) {
    conditions.push(
      sql`${schema.cards.id} IN (
        SELECT ${schema.cardLabels.cardId} FROM ${schema.cardLabels}
        WHERE ${schema.cardLabels.labelId} = ${labelId}
      )` as any,
    );
  }

  // Step 4: Execute search query with joins
  const rows = await db
    .select({
      id: schema.cards.id,
      title: schema.cards.title,
      cardType: schema.cards.cardType,
      dueDate: schema.cards.dueDate,
      boardId: schema.cards.boardId,
      columnId: schema.cards.columnId,
      boardName: schema.boards.name,
      teamId: schema.boards.teamId,
      columnName: schema.columns.name,
    })
    .from(schema.cards)
    .innerJoin(schema.boards, eq(schema.cards.boardId, schema.boards.id))
    .innerJoin(schema.columns, eq(schema.cards.columnId, schema.columns.id))
    .where(and(...conditions))
    .orderBy(desc(schema.cards.updatedAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  // Step 5: Fetch labels for result cards
  const resultCardIds = items.map((r) => r.id);
  const cardLabelRows =
    resultCardIds.length > 0
      ? await db.query.cardLabels.findMany({
          where: inArray(schema.cardLabels.cardId, resultCardIds),
          with: {
            label: { columns: { id: true, name: true, color: true } },
          },
        })
      : [];

  const labelsByCard: Record<string, Array<{ id: string; name: string; color: string }>> = {};
  for (const row of cardLabelRows) {
    if (!labelsByCard[row.cardId]) labelsByCard[row.cardId] = [];
    labelsByCard[row.cardId].push(row.label);
  }

  return {
    results: items.map((r) => ({
      id: r.id,
      title: r.title,
      cardType: r.cardType,
      dueDate: r.dueDate?.toISOString() ?? null,
      labels: labelsByCard[r.id] ?? [],
      boardId: r.boardId,
      boardName: r.boardName,
      teamId: r.teamId,
      columnId: r.columnId,
      columnName: r.columnName,
    })),
    total: items.length,
    hasMore,
  };
}
