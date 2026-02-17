# Layer 2: Card Richness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add swimlanes CRUD, assignees CRUD, card type selection UI, column reorder DnD, and board grid layout (columns × swimlanes).

**Architecture:** Backend adds swimlanes and assignees modules following existing patterns (service/controller/routes). Frontend evolves from flat column layout to CSS Grid (columns × swimlanes). Single swimlane = flat layout identical to Layer 1; multi swimlane = 2D grid.

**Tech Stack:** Express 5, Drizzle ORM, Zod, React, Zustand + Immer, @dnd-kit/react, Tailwind CSS v4, lucide-react

---

### Task 1: Shared Schemas (swimlane, assignee, card updates)

**Files:**
- Create: `packages/shared/src/validation/swimlane.schema.ts`
- Create: `packages/shared/src/validation/assignee.schema.ts`
- Modify: `packages/shared/src/validation/card.schema.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Create swimlane validation schemas**

Create `packages/shared/src/validation/swimlane.schema.ts`:

```typescript
import { z } from 'zod';

export const createSwimlaneSchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateSwimlaneSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export const moveSwimlaneSchema = z.object({
  afterId: z.string().uuid().nullable(),
});

export type CreateSwimlaneInput = z.infer<typeof createSwimlaneSchema>;
export type UpdateSwimlaneInput = z.infer<typeof updateSwimlaneSchema>;
export type MoveSwimlaneInput = z.infer<typeof moveSwimlaneSchema>;
```

**Step 2: Create assignee validation schema**

Create `packages/shared/src/validation/assignee.schema.ts`:

```typescript
import { z } from 'zod';

export const addAssigneeSchema = z.object({
  userId: z.string().uuid(),
});

export type AddAssigneeInput = z.infer<typeof addAssigneeSchema>;
```

**Step 3: Update card schemas to support optional swimlaneId**

Modify `packages/shared/src/validation/card.schema.ts`:
- Add `swimlaneId: z.string().uuid().optional()` to `createCardSchema`
- Add `swimlaneId: z.string().uuid().optional()` to `moveCardSchema`

**Step 4: Export new schemas from barrel**

Add to `packages/shared/src/index.ts`:
```typescript
export * from './validation/swimlane.schema.js';
export * from './validation/assignee.schema.js';
```

**Step 5: Verify TypeScript compiles**

Run: `cd /Users/gerrit/Code/trello-clone && pnpm --filter @trello-clone/shared build`

**Step 6: Commit**

```bash
git add packages/shared/
git commit -m "feat: add swimlane and assignee validation schemas, add swimlaneId to card schemas"
```

---

### Task 2: Swimlanes CRUD Backend

**Files:**
- Create: `apps/api/src/modules/swimlanes/swimlanes.service.ts`
- Create: `apps/api/src/modules/swimlanes/swimlanes.controller.ts`
- Create: `apps/api/src/modules/swimlanes/swimlanes.routes.ts`
- Modify: `apps/api/src/index.ts`

**Context:** Follow existing patterns from columns module (service/controller/routes). Use same `requireBoardAccess` pattern. Use fractional indexing for position. Default swimlane cannot be deleted.

**Step 1: Create swimlanes service**

Create `apps/api/src/modules/swimlanes/swimlanes.service.ts` with:
- `requireBoardAccess(boardId, userId)` — same pattern as columns service
- `createSwimlane(boardId, userId, input)` — fractional indexing for position
- `updateSwimlane(swimlaneId, userId, input)` — blocks rename of default? No, rename is fine.
- `moveSwimlane(swimlaneId, userId, afterId)` — same pattern as moveColumn
- `deleteSwimlane(swimlaneId, userId)` — blocks if `isDefault === true`, blocks if swimlane has cards

**Step 2: Create swimlanes controller**

Create `apps/api/src/modules/swimlanes/swimlanes.controller.ts`:
- `createHandler`, `updateHandler`, `moveHandler`, `deleteHandler`
- Same pattern as columns controller
- Use `req.params.boardId as string`, `req.params.swimlaneId as string`

**Step 3: Create swimlanes routes**

Create `apps/api/src/modules/swimlanes/swimlanes.routes.ts`:
- `POST /` — validate(createSwimlaneSchema)
- `PATCH /:swimlaneId` — validate(updateSwimlaneSchema)
- `PATCH /:swimlaneId/move` — validate(moveSwimlaneSchema)
- `DELETE /:swimlaneId`
- Use `Router({ mergeParams: true })` with `RouterType` annotation

**Step 4: Register route in index.ts**

Add to `apps/api/src/index.ts`:
```typescript
import { swimlaneRoutes } from './modules/swimlanes/swimlanes.routes.js';
app.use('/api/v1/boards/:boardId/swimlanes', swimlaneRoutes);
```

**Step 5: Verify TypeScript compiles**

Run: `cd /Users/gerrit/Code/trello-clone && pnpm --filter @trello-clone/api build`

**Step 6: Commit**

```bash
git add apps/api/src/modules/swimlanes/ apps/api/src/index.ts
git commit -m "feat: add swimlanes CRUD backend"
```

---

### Task 3: Assignees CRUD Backend

**Files:**
- Create: `apps/api/src/modules/assignees/assignees.service.ts`
- Create: `apps/api/src/modules/assignees/assignees.controller.ts`
- Create: `apps/api/src/modules/assignees/assignees.routes.ts`
- Modify: `apps/api/src/modules/cards/cards.routes.ts`

**Context:** Assignees are scoped to cards. Routes mounted as sub-router under cards: `/boards/:boardId/cards/:cardId/assignees`. Service must verify the target user is a member of the board's team.

**Step 1: Create assignees service**

Create `apps/api/src/modules/assignees/assignees.service.ts` with:
- `addAssignee(boardId, cardId, userId, input: AddAssigneeInput)`:
  - Find card, verify board matches
  - Find board, find team membership for `input.userId` → 404 if not team member
  - Insert into cardAssignees (handle unique constraint = already assigned, return 409 or ignore)
  - Return assignee info (userId, displayName, avatarUrl)
- `removeAssignee(boardId, cardId, userId, targetUserId)`:
  - Find card, verify board matches
  - Verify current user has board access
  - Delete from cardAssignees where cardId + targetUserId
- `listAssignees(boardId, cardId, userId)`:
  - Find card, verify board access
  - Query cardAssignees with user join

**Step 2: Create assignees controller**

Create `apps/api/src/modules/assignees/assignees.controller.ts`:
- `addHandler`, `removeHandler`, `listHandler`
- Use `req.params.boardId as string`, `req.params.cardId as string`

**Step 3: Create assignees routes**

Create `apps/api/src/modules/assignees/assignees.routes.ts`:
- `GET /` — listHandler
- `POST /` — validate(addAssigneeSchema), addHandler
- `DELETE /:userId` — removeHandler
- Use `Router({ mergeParams: true })` with `RouterType` annotation

**Step 4: Mount as sub-router under cards**

Modify `apps/api/src/modules/cards/cards.routes.ts`:
```typescript
import { assigneeRoutes } from '../assignees/assignees.routes.js';
router.use('/:cardId/assignees', assigneeRoutes);
```

**Step 5: Verify TypeScript compiles**

Run: `cd /Users/gerrit/Code/trello-clone && pnpm --filter @trello-clone/api build`

**Step 6: Commit**

```bash
git add apps/api/src/modules/assignees/ apps/api/src/modules/cards/cards.routes.ts
git commit -m "feat: add assignees CRUD backend"
```

---

### Task 4: Update moveCard + createCard for swimlaneId

**Files:**
- Modify: `apps/api/src/modules/cards/cards.service.ts`

**Context:** `moveCard` should accept optional `swimlaneId`. If provided, card moves to that swimlane. `createCard` should accept optional `swimlaneId` — if provided, use it instead of default swimlane (verify it belongs to same board).

**Step 1: Update createCard**

In `cards.service.ts` `createCard`:
- If `input.swimlaneId` is provided, verify it belongs to `boardId`
- Otherwise, fall back to default swimlane (existing behavior)
- Use the resolved swimlaneId for position calculation and insert

**Step 2: Update moveCard**

In `cards.service.ts` `moveCard`:
- If `input.swimlaneId` is provided, verify it belongs to `card.boardId`
- Use `input.swimlaneId ?? card.swimlaneId` as target swimlane
- Update the query for `cardsInTarget` to use the resolved swimlaneId
- Add `swimlaneId` to the `.set()` call

**Step 3: Verify TypeScript compiles**

Run: `cd /Users/gerrit/Code/trello-clone && pnpm --filter @trello-clone/api build`

**Step 4: Commit**

```bash
git add apps/api/src/modules/cards/cards.service.ts
git commit -m "feat: support optional swimlaneId in createCard and moveCard"
```

---

### Task 5: Card Type Selection in AddCardForm + Icons

**Files:**
- Modify: `apps/web/src/features/boards/AddCardForm.tsx`
- Modify: `apps/web/src/features/boards/CardComponent.tsx`

**Context:** AddCardForm should show 3 pill buttons for card type (Story/Bug/Task) with lucide-react icons. CardComponent should show lucide icons in type badges instead of text-only. Icons: BookOpen=Story, Bug=Bug, CheckSquare=Task.

**Step 1: Verify lucide-react is installed**

Check if `lucide-react` is in `apps/web/package.json`. If not, install it.

**Step 2: Update AddCardForm with card type selector**

Modify `apps/web/src/features/boards/AddCardForm.tsx`:
- Add `cardType` state (default: `'task'`)
- Add 3 pill buttons below textarea showing icon + label for each type
- Selected pill gets highlighted styling
- Pass `cardType` in API call: `cardsApi.createCard(boardId, { title, columnId, cardType })`
- Add `cardType` to the `addCard` store call

**Step 3: Update CardComponent with lucide icons**

Modify `apps/web/src/features/boards/CardComponent.tsx`:
- Import `BookOpen`, `Bug`, `CheckSquare` from `lucide-react`
- Add icon mapping: `{ story: BookOpen, bug: Bug, task: CheckSquare }`
- Render icon (size 12) next to type text in badge

**Step 4: Verify TypeScript compiles and dev server works**

Run: `cd /Users/gerrit/Code/trello-clone && pnpm --filter @trello-clone/web build`

**Step 5: Commit**

```bash
git add apps/web/src/features/boards/AddCardForm.tsx apps/web/src/features/boards/CardComponent.tsx
git commit -m "feat: add card type selector in AddCardForm, add lucide icons to card badges"
```

---

### Task 6: Column Reorder (Frontend DnD)

**Files:**
- Modify: `apps/web/src/features/boards/BoardPage.tsx`

**Context:** Currently `handleDragEnd` returns early for `source.type === 'column'`. Enable column reorder by calculating afterId and calling `columnsApi.moveColumn`. Update store via `reorderColumns`.

**Step 1: Update handleDragEnd in BoardPage**

Modify `apps/web/src/features/boards/BoardPage.tsx`:
- Import `* as columnsApi from '../../api/columns.api.js'`
- Remove the early return for `source.type === 'column'`
- Add column reorder logic:
  - Find the column being dragged by `source.id`
  - Determine `afterId` from `target` (if target is a column, find the column before it)
  - Call `columnsApi.moveColumn(board.id, columnId, { afterId })`
  - Update store: find the column, update its position, resort columns

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/gerrit/Code/trello-clone && pnpm --filter @trello-clone/web build`

**Step 3: Commit**

```bash
git add apps/web/src/features/boards/BoardPage.tsx
git commit -m "feat: enable column reorder via drag and drop"
```

---

### Task 7: Board Grid Layout (Columns × Swimlanes)

**Files:**
- Create: `apps/web/src/api/swimlanes.api.ts`
- Create: `apps/web/src/features/boards/SwimlaneRow.tsx`
- Create: `apps/web/src/features/boards/AddSwimlaneForm.tsx`
- Modify: `apps/web/src/stores/boardStore.ts`
- Modify: `apps/web/src/features/boards/BoardPage.tsx`
- Modify: `apps/web/src/features/boards/ColumnComponent.tsx`
- Modify: `apps/web/src/features/boards/CardComponent.tsx`
- Modify: `apps/web/src/features/boards/AddCardForm.tsx`

**Context:** Transform from flat column layout to 2D grid (columns × swimlanes). When only 1 swimlane (default), render flat layout identical to Layer 1 (no swimlane headers). When multiple swimlanes, render CSS Grid with swimlane header rows.

**Step 1: Create swimlanes API client**

Create `apps/web/src/api/swimlanes.api.ts`:
- `createSwimlane(boardId, input)`, `updateSwimlane(boardId, swimlaneId, input)`, `moveSwimlane(boardId, swimlaneId, input)`, `deleteSwimlane(boardId, swimlaneId)`

**Step 2: Update boardStore**

Modify `apps/web/src/stores/boardStore.ts`:
- Add swimlane actions: `addSwimlane`, `updateSwimlane`, `removeSwimlane`, `reorderSwimlanes`
- Update `moveCard` signature: `(cardId, toColumnId, toSwimlaneId, newPosition)` — also sets `swimlaneId`

**Step 3: Update BoardPage for grid layout**

Modify `apps/web/src/features/boards/BoardPage.tsx`:
- Group cards by `columnId:swimlaneId` cell key instead of just `columnId`
- If single swimlane: render flat layout (existing column-based view)
- If multi swimlane: render CSS Grid with `gridTemplateColumns: 200px repeat(N, 272px) auto`
- Each row = swimlane, each cell = column×swimlane intersection containing cards + AddCardForm

**Step 4: Create SwimlaneRow component**

Create `apps/web/src/features/boards/SwimlaneRow.tsx`:
- Shows swimlane name as row header (left column)
- Shows cells for each column intersection
- Editable name (inline edit on click)
- Delete button (only for non-default swimlanes)

**Step 5: Create AddSwimlaneForm**

Create `apps/web/src/features/boards/AddSwimlaneForm.tsx`:
- Simple "+ Swimlane hinzufügen" button that opens inline input
- Calls `swimlanesApi.createSwimlane` then `addSwimlane` to store

**Step 6: Update ColumnComponent, CardComponent, AddCardForm**

- `ColumnComponent`: In flat mode, works as before. In grid mode, acts as column header only.
- `CardComponent`: Update DnD group key to `columnId:swimlaneId` when in grid mode
- `AddCardForm`: Accept optional `swimlaneId` prop, pass to API call

**Step 7: Verify TypeScript compiles**

Run: `cd /Users/gerrit/Code/trello-clone && pnpm --filter @trello-clone/web build`

**Step 8: Commit**

```bash
git add apps/web/
git commit -m "feat: add board grid layout with swimlane support"
```

---

### Task 8: Swimlane-Aware Card Drag & Drop

**Files:**
- Modify: `apps/web/src/features/boards/BoardPage.tsx`

**Context:** Update `handleDragEnd` to extract target swimlaneId from DnD data and pass it to `moveCard` API. In flat mode (single swimlane), swimlaneId comes from the card. In grid mode, swimlaneId comes from the cell's data attribute.

**Step 1: Update handleDragEnd**

Modify `apps/web/src/features/boards/BoardPage.tsx`:
- Extract `targetSwimlaneId` from target DnD data (cell data includes swimlaneId)
- Pass `swimlaneId` to `cardsApi.moveCard` call
- Update `moveCardInStore` call to include swimlaneId

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/gerrit/Code/trello-clone && pnpm --filter @trello-clone/web build`

**Step 3: Commit**

```bash
git add apps/web/src/features/boards/BoardPage.tsx
git commit -m "feat: swimlane-aware card drag and drop"
```
