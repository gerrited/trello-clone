# Layer 1: Core Board — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the core Kanban board experience: Board CRUD within Teams, Column CRUD with fractional indexing and WIP limits, Card CRUD with ordering, a denormalized board endpoint, and a React frontend with drag & drop card movement.

**Architecture:** Backend adds three new module folders (`boards/`, `columns/`, `cards/`) following the existing pattern (routes → controller → service). A shared `ordering.ts` utility wraps `fractional-indexing`. Board creation auto-creates a default swimlane (required by schema). The frontend adds a Zustand `boardStore`, API client functions, and a full board view using `@dnd-kit/react` for drag & drop. Cards move between columns via `PATCH /cards/:cardId/move`.

**Tech Stack:** Express 5, Drizzle ORM, fractional-indexing, Zod, @dnd-kit/react, @dnd-kit/helpers, Zustand + Immer, Tailwind CSS v4, lucide-react

---

## Task 1: Shared Validation Schemas for Boards, Columns, and Cards

**Files:**
- Create: `packages/shared/src/validation/board.schema.ts`
- Create: `packages/shared/src/validation/column.schema.ts`
- Create: `packages/shared/src/validation/card.schema.ts`
- Modify: `packages/shared/src/index.ts`

**What to build:**

Add Zod schemas for all board/column/card mutations. Follow the pattern in `packages/shared/src/validation/team.schema.ts`.

**`packages/shared/src/validation/board.schema.ts`:**

```typescript
import { z } from 'zod';

export const createBoardSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export const updateBoardSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  isArchived: z.boolean().optional(),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
```

**`packages/shared/src/validation/column.schema.ts`:**

```typescript
import { z } from 'zod';

export const createColumnSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  wipLimit: z.number().int().min(1).nullable().optional(),
});

export const updateColumnSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  wipLimit: z.number().int().min(1).nullable().optional(),
});

export const moveColumnSchema = z.object({
  afterId: z.string().uuid().nullable(),
});

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type MoveColumnInput = z.infer<typeof moveColumnSchema>;
```

**`packages/shared/src/validation/card.schema.ts`:**

```typescript
import { z } from 'zod';

export const createCardSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  cardType: z.enum(['story', 'bug', 'task']).optional(),
  columnId: z.string().uuid(),
});

export const updateCardSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  cardType: z.enum(['story', 'bug', 'task']).optional(),
  isArchived: z.boolean().optional(),
});

export const moveCardSchema = z.object({
  columnId: z.string().uuid(),
  afterId: z.string().uuid().nullable(),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type MoveCardInput = z.infer<typeof moveCardSchema>;
```

**Add exports to `packages/shared/src/index.ts`:**

```typescript
// Add these lines:
export * from './validation/board.schema.js';
export * from './validation/column.schema.js';
export * from './validation/card.schema.js';
```

**Verify:** `pnpm --filter @trello-clone/shared build` succeeds.

**Commit:** `feat: add shared validation schemas for boards, columns, and cards`

---

## Task 2: Fractional Indexing Utility

**Files:**
- Create: `apps/api/src/utils/ordering.ts`

**What to build:**

A thin utility around the `fractional-indexing` library. This abstracts the API so services just call `getPositionBetween(before, after)` or `getInitialPosition()`.

**`apps/api/src/utils/ordering.ts`:**

```typescript
import { generateKeyBetween } from 'fractional-indexing';

/**
 * Generate a position key for inserting an item at the end of a list.
 * @param lastPosition - The position of the current last item, or null if list is empty.
 */
export function getPositionAfter(lastPosition: string | null): string {
  return generateKeyBetween(lastPosition, null);
}

/**
 * Generate a position key for inserting an item before the first item.
 * @param firstPosition - The position of the current first item, or null if list is empty.
 */
export function getPositionBefore(firstPosition: string | null): string {
  return generateKeyBetween(null, firstPosition);
}

/**
 * Generate a position key between two adjacent items.
 * @param before - Position of the item before, or null for start of list.
 * @param after - Position of the item after, or null for end of list.
 */
export function getPositionBetween(before: string | null, after: string | null): string {
  return generateKeyBetween(before, after);
}
```

**Verify:** `cd apps/api && npx tsx -e "import { getPositionAfter } from './src/utils/ordering.js'; console.log(getPositionAfter(null))"` prints `a0`.

**Commit:** `feat: add fractional indexing utility for ordering`

---

## Task 3: Board CRUD — Service, Controller, Routes

**Files:**
- Create: `apps/api/src/modules/boards/boards.service.ts`
- Create: `apps/api/src/modules/boards/boards.controller.ts`
- Create: `apps/api/src/modules/boards/boards.routes.ts`
- Modify: `apps/api/src/index.ts` (register routes)

**Context:**

Follow the exact patterns in `apps/api/src/modules/teams/`. The service layer does DB queries + authorization; the controller does try/catch + response formatting; routes wire up middleware.

**Key behavior:**
- Board creation requires the user to be a member of the team (`teamId` comes from the URL).
- Board creation auto-creates a default swimlane (name: "Default", isDefault: true) — required because `cards.swimlaneId` is NOT NULL.
- Board creation auto-creates 3 starter columns: "To Do", "In Progress", "Done" with fractional positions.
- List boards returns only non-archived boards for a team the user belongs to.
- The denormalized `GET /boards/:boardId` returns the board with all its columns (sorted by position), the default swimlane, and all non-archived cards (each with `CardSummary` shape).

**`apps/api/src/modules/boards/boards.service.ts`:**

```typescript
import { eq, and, asc } from 'drizzle-orm';
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

  const [board] = await db
    .insert(schema.boards)
    .values({
      teamId,
      name: input.name,
      description: input.description ?? null,
      createdBy: userId,
    })
    .returning();

  // Create default swimlane
  await db.insert(schema.swimlanes).values({
    boardId: board.id,
    name: 'Default',
    position: getPositionAfter(null),
    isDefault: true,
  });

  // Create starter columns
  let pos: string | null = null;
  for (const name of ['To Do', 'In Progress', 'Done']) {
    pos = getPositionAfter(pos);
    await db.insert(schema.columns).values({
      boardId: board.id,
      name,
      position: pos,
    });
  }

  return board;
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

  // Transform cards into CardSummary shape
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
    commentCount: 0,    // Will be populated in Layer 3
    subtaskCount: 0,     // Will be populated in Layer 3
    subtaskDoneCount: 0, // Will be populated in Layer 3
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
```

**`apps/api/src/modules/boards/boards.controller.ts`:**

```typescript
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as boardsService from './boards.service.js';

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const board = await boardsService.createBoard(req.params.teamId, req.userId!, req.body);
    res.status(201).json({ board });
  } catch (err) {
    next(err);
  }
}

export async function listHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const boards = await boardsService.listBoards(req.params.teamId, req.userId!);
    res.json({ boards });
  } catch (err) {
    next(err);
  }
}

export async function getHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const board = await boardsService.getBoard(req.params.boardId, req.userId!);
    res.json({ board });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const board = await boardsService.updateBoard(req.params.boardId, req.userId!, req.body);
    res.json({ board });
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await boardsService.deleteBoard(req.params.boardId, req.userId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
```

**`apps/api/src/modules/boards/boards.routes.ts`:**

```typescript
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createBoardSchema, updateBoardSchema } from '@trello-clone/shared';
import * as ctrl from './boards.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

// Nested under /teams/:teamId/boards
router.post('/', validate(createBoardSchema), ctrl.createHandler);
router.get('/', ctrl.listHandler);

// Board-level routes (boardId in path)
router.get('/:boardId', ctrl.getHandler);
router.patch('/:boardId', validate(updateBoardSchema), ctrl.updateHandler);
router.delete('/:boardId', ctrl.deleteHandler);

export { router as boardRoutes };
```

**Modify `apps/api/src/index.ts` — add after teamRoutes:**

```typescript
import { boardRoutes } from './modules/boards/boards.routes.js';

// Add after app.use('/api/v1/teams', teamRoutes);
app.use('/api/v1/teams/:teamId/boards', boardRoutes);
```

**Verify:** `cd apps/api && npx tsc --noEmit` passes.

**Commit:** `feat: add Board CRUD with team authorization and default swimlane`

---

## Task 4: Column CRUD — Service, Controller, Routes

**Files:**
- Create: `apps/api/src/modules/columns/columns.service.ts`
- Create: `apps/api/src/modules/columns/columns.controller.ts`
- Create: `apps/api/src/modules/columns/columns.routes.ts`
- Modify: `apps/api/src/index.ts` (register routes)

**Context:**

Columns belong to a board. Authorization: user must be a team member of the board's team. Columns use fractional indexing for position. New columns are appended at the end. Moving a column means calculating a new position between two adjacent columns.

**`apps/api/src/modules/columns/columns.service.ts`:**

```typescript
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
    // Find the next column that isn't the one being moved
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

  // Check if column has cards
  const cardCount = await db.query.cards.findFirst({
    where: eq(schema.cards.columnId, columnId),
  });

  if (cardCount) {
    throw new AppError(400, 'Cannot delete column that contains cards');
  }

  await db.delete(schema.columns).where(eq(schema.columns.id, columnId));
}
```

**`apps/api/src/modules/columns/columns.controller.ts`:**

```typescript
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as columnsService from './columns.service.js';

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const column = await columnsService.createColumn(req.params.boardId, req.userId!, req.body);
    res.status(201).json({ column });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const column = await columnsService.updateColumn(req.params.columnId, req.userId!, req.body);
    res.json({ column });
  } catch (err) {
    next(err);
  }
}

export async function moveHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const column = await columnsService.moveColumn(req.params.columnId, req.userId!, req.body.afterId);
    res.json({ column });
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await columnsService.deleteColumn(req.params.columnId, req.userId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
```

**`apps/api/src/modules/columns/columns.routes.ts`:**

```typescript
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createColumnSchema, updateColumnSchema, moveColumnSchema } from '@trello-clone/shared';
import * as ctrl from './columns.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.post('/', validate(createColumnSchema), ctrl.createHandler);
router.patch('/:columnId', validate(updateColumnSchema), ctrl.updateHandler);
router.patch('/:columnId/move', validate(moveColumnSchema), ctrl.moveHandler);
router.delete('/:columnId', ctrl.deleteHandler);

export { router as columnRoutes };
```

**Modify `apps/api/src/index.ts` — add:**

```typescript
import { columnRoutes } from './modules/columns/columns.routes.js';

app.use('/api/v1/boards/:boardId/columns', columnRoutes);
```

**Verify:** `cd apps/api && npx tsc --noEmit` passes.

**Commit:** `feat: add Column CRUD with fractional indexing and WIP limits`

---

## Task 5: Card CRUD + Move — Service, Controller, Routes

**Files:**
- Create: `apps/api/src/modules/cards/cards.service.ts`
- Create: `apps/api/src/modules/cards/cards.controller.ts`
- Create: `apps/api/src/modules/cards/cards.routes.ts`
- Modify: `apps/api/src/index.ts` (register routes)

**Context:**

Cards belong to a board, column, and swimlane. New cards are appended at the end of the target column (within the board's default swimlane). Moving a card changes its `columnId` and recalculates `position`. Card creation requires `columnId` in the request body.

**`apps/api/src/modules/cards/cards.service.ts`:**

```typescript
import { eq, and, asc } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { AppError } from '../../middleware/error.js';
import { getPositionAfter, getPositionBetween, getPositionBefore } from '../../utils/ordering.js';
import type { CreateCardInput, UpdateCardInput, MoveCardInput } from '@trello-clone/shared';

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

export async function createCard(boardId: string, userId: string, input: CreateCardInput) {
  await requireBoardAccess(boardId, userId);

  // Verify the column belongs to this board
  const column = await db.query.columns.findFirst({
    where: and(eq(schema.columns.id, input.columnId), eq(schema.columns.boardId, boardId)),
  });
  if (!column) throw new AppError(404, 'Column not found on this board');

  // Get the default swimlane
  const defaultSwimlane = await db.query.swimlanes.findFirst({
    where: and(eq(schema.swimlanes.boardId, boardId), eq(schema.swimlanes.isDefault, true)),
  });
  if (!defaultSwimlane) throw new AppError(500, 'Board has no default swimlane');

  // Get last card position in this column+swimlane
  const existingCards = await db.query.cards.findMany({
    where: and(
      eq(schema.cards.columnId, input.columnId),
      eq(schema.cards.swimlaneId, defaultSwimlane.id),
      eq(schema.cards.isArchived, false),
    ),
    orderBy: [asc(schema.cards.position)],
    columns: { position: true },
  });

  const lastPos = existingCards.length > 0
    ? existingCards[existingCards.length - 1].position
    : null;

  const [card] = await db
    .insert(schema.cards)
    .values({
      boardId,
      columnId: input.columnId,
      swimlaneId: defaultSwimlane.id,
      title: input.title,
      description: input.description ?? null,
      cardType: input.cardType ?? 'task',
      position: getPositionAfter(lastPos),
      createdBy: userId,
    })
    .returning();

  return card;
}

export async function getCard(cardId: string, userId: string) {
  const card = await db.query.cards.findFirst({
    where: eq(schema.cards.id, cardId),
    with: {
      assignees: {
        with: {
          user: {
            columns: { id: true, displayName: true, avatarUrl: true },
          },
        },
      },
    },
  });

  if (!card) throw new AppError(404, 'Card not found');

  await requireBoardAccess(card.boardId, userId);

  return {
    ...card,
    assignees: card.assignees.map((a) => ({
      id: a.user.id,
      displayName: a.user.displayName,
      avatarUrl: a.user.avatarUrl,
    })),
  };
}

export async function updateCard(cardId: string, userId: string, input: UpdateCardInput) {
  const card = await db.query.cards.findFirst({
    where: eq(schema.cards.id, cardId),
  });
  if (!card) throw new AppError(404, 'Card not found');

  await requireBoardAccess(card.boardId, userId);

  const [updated] = await db
    .update(schema.cards)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.cards.id, cardId))
    .returning();

  return updated;
}

export async function moveCard(cardId: string, userId: string, input: MoveCardInput) {
  const card = await db.query.cards.findFirst({
    where: eq(schema.cards.id, cardId),
  });
  if (!card) throw new AppError(404, 'Card not found');

  await requireBoardAccess(card.boardId, userId);

  // Verify the target column belongs to the same board
  const targetColumn = await db.query.columns.findFirst({
    where: and(eq(schema.columns.id, input.columnId), eq(schema.columns.boardId, card.boardId)),
  });
  if (!targetColumn) throw new AppError(404, 'Target column not found on this board');

  // Get all non-archived cards in the target column+swimlane (excluding the card being moved)
  const cardsInTarget = await db.query.cards.findMany({
    where: and(
      eq(schema.cards.columnId, input.columnId),
      eq(schema.cards.swimlaneId, card.swimlaneId),
      eq(schema.cards.isArchived, false),
    ),
    orderBy: [asc(schema.cards.position)],
  });

  const otherCards = cardsInTarget.filter((c) => c.id !== cardId);

  let newPosition: string;

  if (input.afterId === null) {
    // Move to the top of the column
    newPosition = getPositionBefore(otherCards[0]?.position ?? null);
  } else {
    const afterIndex = otherCards.findIndex((c) => c.id === input.afterId);
    if (afterIndex === -1) throw new AppError(404, 'Target card not found');

    const afterPos = otherCards[afterIndex].position;
    const beforePos = otherCards[afterIndex + 1]?.position ?? null;

    newPosition = getPositionBetween(afterPos, beforePos);
  }

  const [updated] = await db
    .update(schema.cards)
    .set({
      columnId: input.columnId,
      position: newPosition,
      updatedAt: new Date(),
    })
    .where(eq(schema.cards.id, cardId))
    .returning();

  return updated;
}

export async function deleteCard(cardId: string, userId: string) {
  const card = await db.query.cards.findFirst({
    where: eq(schema.cards.id, cardId),
  });
  if (!card) throw new AppError(404, 'Card not found');

  await requireBoardAccess(card.boardId, userId);

  await db.delete(schema.cards).where(eq(schema.cards.id, cardId));
}
```

**`apps/api/src/modules/cards/cards.controller.ts`:**

```typescript
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as cardsService from './cards.service.js';

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const card = await cardsService.createCard(req.params.boardId, req.userId!, req.body);
    res.status(201).json({ card });
  } catch (err) {
    next(err);
  }
}

export async function getHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const card = await cardsService.getCard(req.params.cardId, req.userId!);
    res.json({ card });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const card = await cardsService.updateCard(req.params.cardId, req.userId!, req.body);
    res.json({ card });
  } catch (err) {
    next(err);
  }
}

export async function moveHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const card = await cardsService.moveCard(req.params.cardId, req.userId!, req.body);
    res.json({ card });
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await cardsService.deleteCard(req.params.cardId, req.userId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
```

**`apps/api/src/modules/cards/cards.routes.ts`:**

```typescript
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createCardSchema, updateCardSchema, moveCardSchema } from '@trello-clone/shared';
import * as ctrl from './cards.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

// Nested under /boards/:boardId/cards
router.post('/', validate(createCardSchema), ctrl.createHandler);
router.get('/:cardId', ctrl.getHandler);
router.patch('/:cardId', validate(updateCardSchema), ctrl.updateHandler);
router.patch('/:cardId/move', validate(moveCardSchema), ctrl.moveHandler);
router.delete('/:cardId', ctrl.deleteHandler);

export { router as cardRoutes };
```

**Modify `apps/api/src/index.ts` — add:**

```typescript
import { cardRoutes } from './modules/cards/cards.routes.js';

app.use('/api/v1/boards/:boardId/cards', cardRoutes);
```

**Verify:** `cd apps/api && npx tsc --noEmit` passes.

**Commit:** `feat: add Card CRUD with move endpoint and fractional indexing`

---

## Task 6: Install @dnd-kit/react and Frontend API Client Functions

**Files:**
- Create: `apps/web/src/api/boards.api.ts`
- Create: `apps/web/src/api/columns.api.ts`
- Create: `apps/web/src/api/cards.api.ts`

**What to build:**

Install @dnd-kit packages and create API client functions for boards, columns, and cards. Follow the pattern in `apps/web/src/api/auth.api.ts`.

**Install:**

```bash
cd /Users/gerrit/Code/trello-clone
pnpm --filter @trello-clone/web add @dnd-kit/react @dnd-kit/helpers @dnd-kit/abstract
```

**`apps/web/src/api/boards.api.ts`:**

```typescript
import { api } from './client.js';
import type { Board, CreateBoardInput, UpdateBoardInput, CardSummary, Column, Swimlane } from '@trello-clone/shared';

export interface BoardDetail extends Board {
  columns: Column[];
  swimlanes: Swimlane[];
  cards: CardSummary[];
}

export async function listBoards(teamId: string): Promise<Board[]> {
  const { data } = await api.get<{ boards: Board[] }>(`/teams/${teamId}/boards`);
  return data.boards;
}

export async function getBoard(teamId: string, boardId: string): Promise<BoardDetail> {
  const { data } = await api.get<{ board: BoardDetail }>(`/teams/${teamId}/boards/${boardId}`);
  return data.board;
}

export async function createBoard(teamId: string, input: CreateBoardInput): Promise<Board> {
  const { data } = await api.post<{ board: Board }>(`/teams/${teamId}/boards`, input);
  return data.board;
}

export async function updateBoard(teamId: string, boardId: string, input: UpdateBoardInput): Promise<Board> {
  const { data } = await api.patch<{ board: Board }>(`/teams/${teamId}/boards/${boardId}`, input);
  return data.board;
}

export async function deleteBoard(teamId: string, boardId: string): Promise<void> {
  await api.delete(`/teams/${teamId}/boards/${boardId}`);
}
```

**`apps/web/src/api/columns.api.ts`:**

```typescript
import { api } from './client.js';
import type { Column, CreateColumnInput, UpdateColumnInput, MoveColumnInput } from '@trello-clone/shared';

export async function createColumn(boardId: string, input: CreateColumnInput): Promise<Column> {
  const { data } = await api.post<{ column: Column }>(`/boards/${boardId}/columns`, input);
  return data.column;
}

export async function updateColumn(columnId: string, input: UpdateColumnInput): Promise<Column> {
  // columnId is enough — board context inferred server-side
  const { data } = await api.patch<{ column: Column }>(`/boards/_/columns/${columnId}`, input);
  return data.column;
}

export async function moveColumn(columnId: string, input: MoveColumnInput): Promise<Column> {
  const { data } = await api.patch<{ column: Column }>(`/boards/_/columns/${columnId}/move`, input);
  return data.column;
}

export async function deleteColumn(columnId: string): Promise<void> {
  await api.delete(`/boards/_/columns/${columnId}`);
}
```

**`apps/web/src/api/cards.api.ts`:**

```typescript
import { api } from './client.js';
import type { Card, CreateCardInput, UpdateCardInput, MoveCardInput } from '@trello-clone/shared';

export async function createCard(boardId: string, input: CreateCardInput): Promise<Card> {
  const { data } = await api.post<{ card: Card }>(`/boards/${boardId}/cards`, input);
  return data.card;
}

export async function getCard(cardId: string): Promise<Card> {
  const { data } = await api.get<{ card: Card }>(`/boards/_/cards/${cardId}`);
  return data.card;
}

export async function updateCard(cardId: string, input: UpdateCardInput): Promise<Card> {
  const { data } = await api.patch<{ card: Card }>(`/boards/_/cards/${cardId}`, input);
  return data.card;
}

export async function moveCard(cardId: string, input: MoveCardInput): Promise<Card> {
  const { data } = await api.patch<{ card: Card }>(`/boards/_/cards/${cardId}/move`, input);
  return data.card;
}

export async function deleteCard(cardId: string): Promise<void> {
  await api.delete(`/boards/_/cards/${cardId}`);
}
```

**Note on `_` placeholder in URLs:** The column/card routes use `mergeParams: true` and look up the resource by ID directly (the service fetches `boardId` from the column/card record). The `_` is a placeholder that Express ignores since the route handler doesn't use it. If the implementer finds this pattern problematic, they should instead restructure the routes to not require boardId for update/delete/move operations — e.g., use flat routes like `/api/v1/columns/:columnId` and `/api/v1/cards/:cardId`. Adjust both the backend routes and the API client accordingly.

**Verify:** `cd apps/web && npx tsc --noEmit` passes.

**Commit:** `feat: add frontend API clients for boards, columns, and cards`

---

## Task 7: Board Store (Zustand + Immer)

**Files:**
- Create: `apps/web/src/stores/boardStore.ts`

**What to build:**

A Zustand store using Immer middleware for immutable updates. This store holds the current board's state (columns, cards) and provides actions for loading, adding cards, and moving cards.

**`apps/web/src/stores/boardStore.ts`:**

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Column, Swimlane, CardSummary } from '@trello-clone/shared';
import type { BoardDetail } from '../api/boards.api.js';

interface BoardState {
  board: BoardDetail | null;
  isLoading: boolean;

  setBoard: (board: BoardDetail) => void;
  clearBoard: () => void;
  setLoading: (loading: boolean) => void;

  // Column actions
  addColumn: (column: Column) => void;
  updateColumn: (columnId: string, updates: Partial<Column>) => void;
  removeColumn: (columnId: string) => void;
  reorderColumns: (columns: Column[]) => void;

  // Card actions
  addCard: (card: CardSummary) => void;
  updateCard: (cardId: string, updates: Partial<CardSummary>) => void;
  removeCard: (cardId: string) => void;
  moveCard: (cardId: string, toColumnId: string, newPosition: string) => void;
}

export const useBoardStore = create<BoardState>()(
  devtools(
    immer((set) => ({
      board: null,
      isLoading: false,

      setBoard: (board) => set((state) => { state.board = board; state.isLoading = false; }),
      clearBoard: () => set((state) => { state.board = null; }),
      setLoading: (loading) => set((state) => { state.isLoading = loading; }),

      addColumn: (column) => set((state) => {
        if (!state.board) return;
        state.board.columns.push(column);
        state.board.columns.sort((a, b) => a.position.localeCompare(b.position));
      }),

      updateColumn: (columnId, updates) => set((state) => {
        if (!state.board) return;
        const col = state.board.columns.find((c) => c.id === columnId);
        if (col) Object.assign(col, updates);
      }),

      removeColumn: (columnId) => set((state) => {
        if (!state.board) return;
        state.board.columns = state.board.columns.filter((c) => c.id !== columnId);
      }),

      reorderColumns: (columns) => set((state) => {
        if (!state.board) return;
        state.board.columns = columns;
      }),

      addCard: (card) => set((state) => {
        if (!state.board) return;
        state.board.cards.push(card);
      }),

      updateCard: (cardId, updates) => set((state) => {
        if (!state.board) return;
        const card = state.board.cards.find((c) => c.id === cardId);
        if (card) Object.assign(card, updates);
      }),

      removeCard: (cardId) => set((state) => {
        if (!state.board) return;
        state.board.cards = state.board.cards.filter((c) => c.id !== cardId);
      }),

      moveCard: (cardId, toColumnId, newPosition) => set((state) => {
        if (!state.board) return;
        const card = state.board.cards.find((c) => c.id === cardId);
        if (card) {
          card.columnId = toColumnId;
          card.position = newPosition;
        }
      }),
    })),
    { name: 'BoardStore' },
  ),
);
```

**Verify:** `cd apps/web && npx tsc --noEmit` passes.

**Commit:** `feat: add Zustand board store with Immer middleware`

---

## Task 8: Teams List Page + Board List Page

**Files:**
- Create: `apps/web/src/api/teams.api.ts`
- Create: `apps/web/src/features/teams/TeamsPage.tsx`
- Create: `apps/web/src/features/boards/BoardListPage.tsx`
- Create: `apps/web/src/components/layout/AppLayout.tsx`
- Modify: `apps/web/src/App.tsx` (update routes)

**What to build:**

Replace the placeholder Teams page with a real page that lists the user's teams. Each team links to its board list. The board list page shows boards for a team, with a "Create Board" button. Add a basic app layout with a top nav bar showing app name and logout button.

**`apps/web/src/api/teams.api.ts`:**

```typescript
import { api } from './client.js';
import type { Team } from '@trello-clone/shared';

export async function listTeams(): Promise<(Team & { role: string })[]> {
  const { data } = await api.get<{ teams: (Team & { role: string })[] }>('/teams');
  return data.teams;
}
```

**`apps/web/src/components/layout/AppLayout.tsx`:**

A simple layout with a top nav bar and a content area. Shows "Trello Clone" on the left, and user info + logout button on the right.

```typescript
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuthStore } from '../../stores/authStore.js';
import { logoutUser } from '../../api/auth.api.js';
import { Button } from '../ui/Button.js';

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logoutUser();
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/teams" className="text-lg font-bold text-gray-900">
            Trello Clone
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.displayName}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Abmelden
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
```

**`apps/web/src/features/teams/TeamsPage.tsx`:**

Lists user's teams. Each team is a card that links to `/teams/:teamId/boards`.

```typescript
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listTeams } from '../../api/teams.api.js';
import { AppLayout } from '../../components/layout/AppLayout.js';
import { Button } from '../../components/ui/Button.js';
import type { Team } from '@trello-clone/shared';

export function TeamsPage() {
  const [teams, setTeams] = useState<(Team & { role: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTeams()
      .then(setTeams)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Meine Teams</h1>
        </div>

        {loading ? (
          <p className="text-gray-500">Laden...</p>
        ) : teams.length === 0 ? (
          <p className="text-gray-500">Du bist noch in keinem Team. Erstelle ein neues Team, um loszulegen.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <Link
                key={team.id}
                to={`/teams/${team.id}/boards`}
                className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <h3 className="font-semibold text-gray-900">{team.name}</h3>
                <p className="text-sm text-gray-500 mt-1 capitalize">{team.role}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
```

**`apps/web/src/features/boards/BoardListPage.tsx`:**

Lists boards for a team. Each board links to `/boards/:boardId`. Has a "Create Board" button with an inline form.

```typescript
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { listBoards, createBoard } from '../../api/boards.api.js';
import { AppLayout } from '../../components/layout/AppLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import type { Board } from '@trello-clone/shared';

export function BoardListPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    listBoards(teamId)
      .then(setBoards)
      .finally(() => setLoading(false));
  }, [teamId]);

  const handleCreateBoard = async () => {
    if (!teamId || !newBoardName.trim()) return;
    setCreating(true);
    try {
      const board = await createBoard(teamId, { name: newBoardName.trim() });
      setBoards((prev) => [...prev, board]);
      setNewBoardName('');
      setShowForm(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/teams" className="text-sm text-blue-600 hover:underline">
              ← Teams
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Boards</h1>
          </div>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            + Board erstellen
          </Button>
        </div>

        {showForm && (
          <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
            <div className="flex gap-2">
              <Input
                placeholder="Board Name"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard()}
              />
              <Button onClick={handleCreateBoard} disabled={creating || !newBoardName.trim()}>
                {creating ? 'Erstellen...' : 'Erstellen'}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Abbrechen
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500">Laden...</p>
        ) : boards.length === 0 ? (
          <p className="text-gray-500">Noch keine Boards vorhanden.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((board) => (
              <Link
                key={board.id}
                to={`/boards/${board.id}`}
                className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <h3 className="font-semibold text-gray-900">{board.name}</h3>
                {board.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{board.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
```

**Modify `apps/web/src/App.tsx` — update routes:**

Replace the placeholder `/teams` route and add new routes:

```typescript
import { TeamsPage } from './features/teams/TeamsPage.js';
import { BoardListPage } from './features/boards/BoardListPage.js';

// In <Routes>:
<Route path="/teams" element={<AuthGuard><TeamsPage /></AuthGuard>} />
<Route path="/teams/:teamId/boards" element={<AuthGuard><BoardListPage /></AuthGuard>} />
```

Keep all existing routes (login, register, auth/callback). The `/boards/:boardId` route will be added in the next task.

**Verify:** `cd apps/web && npx tsc --noEmit` passes. Run the dev server and check `/teams` page renders.

**Commit:** `feat: add Teams list page and Board list page with create form`

---

## Task 9: Board Page with Columns, Cards, and Drag & Drop

**Files:**
- Create: `apps/web/src/features/boards/BoardPage.tsx`
- Create: `apps/web/src/features/boards/ColumnComponent.tsx`
- Create: `apps/web/src/features/boards/CardComponent.tsx`
- Create: `apps/web/src/features/boards/AddCardForm.tsx`
- Create: `apps/web/src/features/boards/AddColumnForm.tsx`
- Modify: `apps/web/src/App.tsx` (add board route)

**What to build:**

The main Kanban board view. Uses `@dnd-kit/react` for drag and drop. Columns display horizontally in a scrollable container. Cards are sortable within and between columns.

**Important architecture notes for the implementer:**

1. **@dnd-kit/react** (NOT the older @dnd-kit/core) — Use `DragDropProvider`, `useSortable` from `@dnd-kit/react/sortable`, and `move` from `@dnd-kit/helpers`.
2. Cards are grouped by `columnId` from `board.cards`. Use `useMemo` to derive `cardsByColumn: Record<string, CardSummary[]>` from the store.
3. On `onDragEnd`, call `moveCard` API with the new column and the `afterId` (the card above the drop position).
4. Cards show: title, card type badge (Story/Bug/Task), and assignee avatars.
5. Each column header shows: name, card count, WIP limit (if set), and "Add card" button.

**`apps/web/src/features/boards/BoardPage.tsx`:**

```typescript
import { useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { DragDropProvider } from '@dnd-kit/react';
import { move } from '@dnd-kit/helpers';
import { useBoardStore } from '../../stores/boardStore.js';
import { getBoard } from '../../api/boards.api.js';
import * as cardsApi from '../../api/cards.api.js';
import { AppLayout } from '../../components/layout/AppLayout.js';
import { ColumnComponent } from './ColumnComponent.js';
import { AddColumnForm } from './AddColumnForm.js';
import type { CardSummary } from '@trello-clone/shared';

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { board, isLoading, setBoard, setLoading } = useBoardStore();

  useEffect(() => {
    if (!boardId) return;
    setLoading(true);

    // We need teamId for the API call — get it from the board's URL or fetch it
    // Actually the getBoard API needs teamId. We'll store it in the URL.
    // For now, we fetch via a search approach: try all teams until found.
    // Better: store teamId in the board store or pass it differently.
    // Simplest approach: change the route to include teamId.
  }, [boardId, setBoard, setLoading]);

  // ... see full implementation below
}
```

**IMPORTANT ROUTE DECISION:** The board page needs `teamId` to call `GET /teams/:teamId/boards/:boardId`. Two approaches:

**Approach A (recommended):** Change the route to `/teams/:teamId/boards/:boardId`. This keeps the teamId in the URL and makes the API call straightforward.

**Approach B:** Add a separate endpoint `GET /api/v1/boards/:boardId` that doesn't require teamId (looks up team membership internally).

**Use Approach A.** Update the route to `/teams/:teamId/boards/:boardId` and update the `BoardListPage` links accordingly.

**Updated `apps/web/src/features/boards/BoardPage.tsx`:**

```typescript
import { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router';
import { DragDropProvider } from '@dnd-kit/react';
import { move } from '@dnd-kit/helpers';
import { useBoardStore } from '../../stores/boardStore.js';
import { getBoard } from '../../api/boards.api.js';
import * as cardsApi from '../../api/cards.api.js';
import { AppLayout } from '../../components/layout/AppLayout.js';
import { ColumnComponent } from './ColumnComponent.js';
import { AddColumnForm } from './AddColumnForm.js';
import type { CardSummary } from '@trello-clone/shared';

export function BoardPage() {
  const { teamId, boardId } = useParams<{ teamId: string; boardId: string }>();
  const board = useBoardStore((s) => s.board);
  const isLoading = useBoardStore((s) => s.isLoading);
  const setBoard = useBoardStore((s) => s.setBoard);
  const setLoading = useBoardStore((s) => s.setLoading);
  const moveCardInStore = useBoardStore((s) => s.moveCard);

  useEffect(() => {
    if (!teamId || !boardId) return;
    setLoading(true);
    getBoard(teamId, boardId).then(setBoard);
  }, [teamId, boardId, setBoard, setLoading]);

  // Group cards by column
  const cardsByColumn = useMemo(() => {
    if (!board) return {};
    const grouped: Record<string, CardSummary[]> = {};
    for (const col of board.columns) {
      grouped[col.id] = [];
    }
    for (const card of board.cards) {
      if (grouped[card.columnId]) {
        grouped[card.columnId].push(card);
      }
    }
    // Sort cards within each column by position
    for (const colId of Object.keys(grouped)) {
      grouped[colId].sort((a, b) => a.position.localeCompare(b.position));
    }
    return grouped;
  }, [board]);

  const handleDragOver = (event: any) => {
    const { source } = event.operation;
    if (source?.type === 'column') return;
    // Let dnd-kit handle the visual reorder
  };

  const handleDragEnd = async (event: any) => {
    const { source, target } = event.operation;
    if (event.canceled || !source || !target) return;
    if (source.type === 'column') return; // Column reorder handled in Layer 2

    // source.data and target.data contain our card info
    const cardId = source.id as string;
    const targetColumnId = (target.data?.columnId ?? target.id) as string;

    // Find the card's new position in the target column
    const targetCards = cardsByColumn[targetColumnId] || [];
    const cardIndex = targetCards.findIndex((c) => c.id === cardId);

    // The card above the drop position
    const afterId = cardIndex > 0 ? targetCards[cardIndex - 1].id : null;

    try {
      const updated = await cardsApi.moveCard(cardId, {
        columnId: targetColumnId,
        afterId,
      });
      moveCardInStore(cardId, targetColumnId, updated.position);
    } catch (err) {
      // Reload board on error to reset state
      if (teamId && boardId) {
        getBoard(teamId, boardId).then(setBoard);
      }
    }
  };

  if (isLoading || !board) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Board wird geladen...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 py-4">
        <div className="flex items-center gap-4 mb-4">
          <Link to={`/teams/${teamId}/boards`} className="text-sm text-blue-600 hover:underline">
            ← Boards
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{board.name}</h1>
        </div>

        <DragDropProvider onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {board.columns.map((column, index) => (
              <ColumnComponent
                key={column.id}
                column={column}
                cards={cardsByColumn[column.id] || []}
                index={index}
                boardId={board.id}
              />
            ))}
            <AddColumnForm boardId={board.id} />
          </div>
        </DragDropProvider>
      </div>
    </AppLayout>
  );
}
```

**`apps/web/src/features/boards/ColumnComponent.tsx`:**

```typescript
import { useDroppable } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { CollisionPriority } from '@dnd-kit/abstract';
import { CardComponent } from './CardComponent.js';
import { AddCardForm } from './AddCardForm.js';
import type { Column, CardSummary } from '@trello-clone/shared';

interface ColumnComponentProps {
  column: Column;
  cards: CardSummary[];
  index: number;
  boardId: string;
}

export function ColumnComponent({ column, cards, index, boardId }: ColumnComponentProps) {
  const { ref } = useSortable({
    id: column.id,
    index,
    type: 'column',
    collisionPriority: CollisionPriority.Low,
    accept: ['card', 'column'],
    data: { columnId: column.id },
  });

  const isOverWipLimit = column.wipLimit !== null && cards.length > column.wipLimit;

  return (
    <div
      ref={ref}
      className="flex-shrink-0 w-72 bg-gray-100 rounded-lg flex flex-col max-h-[calc(100vh-10rem)]"
    >
      {/* Column header */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {column.color && (
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: column.color }}
            />
          )}
          <h3 className="font-semibold text-sm text-gray-700">{column.name}</h3>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            isOverWipLimit
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-200 text-gray-600'
          }`}>
            {cards.length}
            {column.wipLimit !== null && ` / ${column.wipLimit}`}
          </span>
        </div>
      </div>

      {/* Cards list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {cards.map((card, cardIndex) => (
          <CardComponent
            key={card.id}
            card={card}
            index={cardIndex}
            columnId={column.id}
          />
        ))}
      </div>

      {/* Add card form */}
      <div className="p-2">
        <AddCardForm boardId={boardId} columnId={column.id} />
      </div>
    </div>
  );
}
```

**`apps/web/src/features/boards/CardComponent.tsx`:**

```typescript
import { useSortable } from '@dnd-kit/react/sortable';
import type { CardSummary } from '@trello-clone/shared';

interface CardComponentProps {
  card: CardSummary;
  index: number;
  columnId: string;
}

const TYPE_COLORS: Record<string, string> = {
  story: 'bg-green-100 text-green-700',
  bug: 'bg-red-100 text-red-700',
  task: 'bg-blue-100 text-blue-700',
};

export function CardComponent({ card, index, columnId }: CardComponentProps) {
  const { ref, isDragging } = useSortable({
    id: card.id,
    index,
    type: 'card',
    accept: 'card',
    group: columnId,
    data: { columnId },
  });

  return (
    <div
      ref={ref}
      className={`bg-white rounded-lg border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[card.cardType]}`}>
          {card.cardType.charAt(0).toUpperCase() + card.cardType.slice(1)}
        </span>
      </div>
      <p className="text-sm text-gray-900 mt-1">{card.title}</p>
      {card.assignees.length > 0 && (
        <div className="flex -space-x-1 mt-2">
          {card.assignees.map((assignee) => (
            <div
              key={assignee.id}
              className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center ring-2 ring-white"
              title={assignee.displayName}
            >
              {assignee.displayName.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**`apps/web/src/features/boards/AddCardForm.tsx`:**

```typescript
import { useState } from 'react';
import { useBoardStore } from '../../stores/boardStore.js';
import * as cardsApi from '../../api/cards.api.js';
import { Button } from '../../components/ui/Button.js';

interface AddCardFormProps {
  boardId: string;
  columnId: string;
}

export function AddCardForm({ boardId, columnId }: AddCardFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const addCard = useBoardStore((s) => s.addCard);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const card = await cardsApi.createCard(boardId, { title: title.trim(), columnId });
      addCard({
        id: card.id,
        columnId: card.columnId,
        swimlaneId: card.swimlaneId,
        parentCardId: card.parentCardId,
        cardType: card.cardType,
        title: card.title,
        position: card.position,
        assignees: [],
        commentCount: 0,
        subtaskCount: 0,
        subtaskDoneCount: 0,
      });
      setTitle('');
      setIsOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full text-left text-sm text-gray-500 hover:text-gray-700 py-1 px-2 rounded hover:bg-gray-200 transition-colors"
      >
        + Karte hinzufügen
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
          if (e.key === 'Escape') setIsOpen(false);
        }}
        placeholder="Kartentitel eingeben..."
        className="w-full rounded border border-gray-300 p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={2}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={submitting || !title.trim()}>
          Hinzufügen
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
```

**`apps/web/src/features/boards/AddColumnForm.tsx`:**

```typescript
import { useState } from 'react';
import { useBoardStore } from '../../stores/boardStore.js';
import * as columnsApi from '../../api/columns.api.js';
import { Button } from '../../components/ui/Button.js';

interface AddColumnFormProps {
  boardId: string;
}

export function AddColumnForm({ boardId }: AddColumnFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const addColumn = useBoardStore((s) => s.addColumn);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const column = await columnsApi.createColumn(boardId, { name: name.trim() });
      addColumn(column);
      setName('');
      setIsOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex-shrink-0 w-72 h-12 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center text-sm transition-colors"
      >
        + Spalte hinzufügen
      </button>
    );
  }

  return (
    <div className="flex-shrink-0 w-72 bg-gray-100 rounded-lg p-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') setIsOpen(false);
        }}
        placeholder="Spaltenname..."
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex gap-2 mt-2">
        <Button size="sm" onClick={handleSubmit} disabled={submitting || !name.trim()}>
          Hinzufügen
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
```

**Modify `apps/web/src/App.tsx` — add board route:**

```typescript
import { BoardPage } from './features/boards/BoardPage.js';

// Add to <Routes>:
<Route path="/teams/:teamId/boards/:boardId" element={<AuthGuard><BoardPage /></AuthGuard>} />
```

**Also update the `BoardListPage` links** from `/boards/${board.id}` to `/teams/${teamId}/boards/${board.id}`.

**Verify:** `cd apps/web && npx tsc --noEmit` passes. Start the full stack (`pnpm dev`) and verify:
1. `/teams` shows team list
2. `/teams/:teamId/boards` shows board list with create form
3. `/teams/:teamId/boards/:boardId` shows the Kanban board with columns and cards
4. Cards can be dragged between columns

**Commit:** `feat: add Board page with columns, cards, and drag & drop`

---

## Summary of API Routes After Layer 1

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
GET    /api/v1/auth/google (OAuth)
GET    /api/v1/auth/google/callback

POST   /api/v1/teams
GET    /api/v1/teams
GET    /api/v1/teams/:teamId
PATCH  /api/v1/teams/:teamId
DELETE /api/v1/teams/:teamId
POST   /api/v1/teams/:teamId/members
DELETE /api/v1/teams/:teamId/members/:userId
PATCH  /api/v1/teams/:teamId/members/:userId

POST   /api/v1/teams/:teamId/boards          (NEW)
GET    /api/v1/teams/:teamId/boards          (NEW)
GET    /api/v1/teams/:teamId/boards/:boardId (NEW — denormalized)
PATCH  /api/v1/teams/:teamId/boards/:boardId (NEW)
DELETE /api/v1/teams/:teamId/boards/:boardId (NEW)

POST   /api/v1/boards/:boardId/columns          (NEW)
PATCH  /api/v1/boards/:boardId/columns/:columnId (NEW)
PATCH  /api/v1/boards/:boardId/columns/:columnId/move (NEW)
DELETE /api/v1/boards/:boardId/columns/:columnId (NEW)

POST   /api/v1/boards/:boardId/cards          (NEW)
GET    /api/v1/boards/:boardId/cards/:cardId  (NEW)
PATCH  /api/v1/boards/:boardId/cards/:cardId  (NEW)
PATCH  /api/v1/boards/:boardId/cards/:cardId/move (NEW)
DELETE /api/v1/boards/:boardId/cards/:cardId  (NEW)
```

## Summary of Frontend Routes After Layer 1

```
/login              — Login page
/register           — Register page
/auth/callback      — OAuth callback
/teams              — Teams list (NEW)
/teams/:teamId/boards              — Board list (NEW)
/teams/:teamId/boards/:boardId     — Kanban board (NEW)
```
