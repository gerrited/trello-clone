# WebMCP Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add seven new WebMCP tools to the board page: `list_cards`, `update_card`, `move_card`, `delete_card`, `list_current_team_members`, `assign_user`, `unassign_user`.

**Architecture:** A `createBoardWebMCPTools({ boardId, teamId })` factory function (plain function, no hooks) returns all 10 tools (Phase 1 + Phase 2). `useBoardWebMCP` is refactored to a thin wrapper that calls the factory and passes results to `useWebMCP`. New `assignees.api.ts` and `getTeam` in `teams.api.ts` provide the required HTTP calls. Tests for all tools live in `boardWebMCPTools.test.ts` and call the factory directly — no `renderHook` needed.

**Tech Stack:** React 19, Zustand 5 + Immer, React Router 7, Vitest 3, jsdom, `@testing-library/react` 16

**Spec:** `docs/superpowers/specs/2026-03-15-web-mcp-phase2-design.md`

---

## Chunk 1: API modules, factory foundation, read tools, and card write tools

### Task 1: New API modules

**Files:**
- Create: `apps/web/src/api/assignees.api.ts`
- Modify: `apps/web/src/api/teams.api.ts`

- [ ] **Step 1: Create `assignees.api.ts`**

```ts
// apps/web/src/api/assignees.api.ts
import { api } from './client.js';

export interface Assignee {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export async function addAssignee(
  boardId: string,
  cardId: string,
  userId: string,
): Promise<Assignee> {
  const res = await api.post<{ assignee: Assignee }>(
    `/boards/${boardId}/cards/${cardId}/assignees`,
    { userId },
  );
  return res.data.assignee;
}

export async function removeAssignee(
  boardId: string,
  cardId: string,
  userId: string,
): Promise<void> {
  await api.delete(`/boards/${boardId}/cards/${cardId}/assignees/${userId}`);
}
```

- [ ] **Step 2: Add `getTeam` to `teams.api.ts`**

The existing file has `listTeams`, `createTeam`, `deleteTeam`. Add `getTeam` at the bottom. Also add the `TeamWithMembers` import — it lives in `@trello-clone/shared`.

```ts
// Add to the import at the top:
import type { Team, CreateTeamInput, TeamWithMembers } from '@trello-clone/shared';

// Add this function at the bottom of the file:
export async function getTeam(teamId: string): Promise<TeamWithMembers> {
  const { data } = await api.get<{ team: TeamWithMembers }>(`/teams/${teamId}`);
  return data.team;
}
```

- [ ] **Step 3: Run existing tests to confirm nothing broken**

```bash
cd /Users/gerrit/Code/trello-clone/apps/web && pnpm vitest run
```

Expected: 18 tests pass (no change from before this task).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/api/assignees.api.ts apps/web/src/api/teams.api.ts
git commit -m "feat: add assignees API module and getTeam to teams API"
```

---

### Task 2: `boardWebMCPTools.ts` — factory foundation, Phase 1 migration, read Phase 2 tools

This task:
1. Creates `boardWebMCPTools.ts` with `createBoardWebMCPTools` factory
2. Migrates Phase 1 tools (`list_current_team_boards`, `list_columns`, `create_card`) into it
3. Adds `list_cards` and `list_current_team_members`
4. Creates `boardWebMCPTools.test.ts` with TDD tests

**Files:**
- Create: `apps/web/src/hooks/boardWebMCPTools.ts`
- Create: `apps/web/src/hooks/boardWebMCPTools.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/hooks/boardWebMCPTools.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBoardWebMCPTools } from './boardWebMCPTools.js';
import { useBoardStore } from '../stores/boardStore.js';
import type { BoardDetail } from '../api/boards.api.js';
import type { Board, CardSummary } from '@trello-clone/shared';

// All API modules mocked — include every function used by any tool in this file
vi.mock('../api/boards.api.js', () => ({ listBoards: vi.fn() }));
vi.mock('../api/cards.api.js', () => ({
  createCard: vi.fn(),
  updateCard: vi.fn(),
  moveCard: vi.fn(),
  deleteCard: vi.fn(),
}));
vi.mock('../api/assignees.api.js', () => ({
  addAssignee: vi.fn(),
  removeAssignee: vi.fn(),
}));
vi.mock('../api/teams.api.js', () => ({ getTeam: vi.fn() }));

import * as boardsApi from '../api/boards.api.js';
import * as cardsApi from '../api/cards.api.js';
import * as assigneesApi from '../api/assignees.api.js';
import * as teamsApi from '../api/teams.api.js';

// Constants — readable UUIDs
const BOARD_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TEAM_ID  = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const COL_1    = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const COL_2    = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const SWIM_1   = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const CARD_1   = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const CARD_2   = '00000000-0000-0000-0000-000000000001';
const USER_1   = '00000000-0000-0000-0000-000000000002';

const makeCard = (overrides: Partial<CardSummary> = {}): CardSummary => ({
  id: CARD_1,
  columnId: COL_1,
  swimlaneId: SWIM_1,
  parentCardId: null,
  cardType: 'task',
  title: 'Test card',
  position: 'a0',
  dueDate: null,
  assignees: [],
  labels: [],
  commentCount: 0,
  subtaskCount: 0,
  subtaskDoneCount: 0,
  attachmentCount: 0,
  ...overrides,
});

const makeBoard = (cards: CardSummary[] = []): BoardDetail => ({
  id: BOARD_ID,
  teamId: TEAM_ID,
  name: 'Test Board',
  description: null,
  createdBy: USER_1,
  isArchived: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  columns: [
    { id: COL_1, boardId: BOARD_ID, name: 'To Do', position: 'a0', wipLimit: null, color: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    { id: COL_2, boardId: BOARD_ID, name: 'Done', position: 'b0', wipLimit: 5, color: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  ],
  swimlanes: [
    { id: SWIM_1, boardId: BOARD_ID, name: 'Default', position: 'a0', isDefault: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  ],
  cards,
  labels: [],
});

// Helper: set store state and create tools in one call
const getTools = (cards: CardSummary[] = []) => {
  useBoardStore.setState({ board: makeBoard(cards), isLoading: false, selectedCardId: null });
  return createBoardWebMCPTools({ boardId: BOARD_ID, teamId: TEAM_ID });
};

const getTool = (name: string, cards: CardSummary[] = []) =>
  getTools(cards).find((t) => t.name === name)!;

beforeEach(() => {
  vi.mocked(boardsApi.listBoards).mockReset();
  vi.mocked(cardsApi.createCard).mockReset();
  vi.mocked(cardsApi.updateCard).mockReset();
  vi.mocked(cardsApi.moveCard).mockReset();
  vi.mocked(cardsApi.deleteCard).mockReset();
  vi.mocked(assigneesApi.addAssignee).mockReset();
  vi.mocked(assigneesApi.removeAssignee).mockReset();
  vi.mocked(teamsApi.getTeam).mockReset();
});

// --- Phase 1 tools (migrated, smoke tests) ---

describe('list_current_team_boards', () => {
  it('returns projected board list', async () => {
    const boards: Board[] = [
      { id: 'b-1', teamId: TEAM_ID, name: 'Alpha', description: null, createdBy: 'u', isArchived: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ];
    vi.mocked(boardsApi.listBoards).mockResolvedValue(boards);
    const tool = getTool('list_current_team_boards');
    const result = await tool.execute({});
    expect(boardsApi.listBoards).toHaveBeenCalledWith(TEAM_ID);
    expect(result).toEqual([{ id: 'b-1', name: 'Alpha' }]);
  });
});

describe('list_columns', () => {
  it('returns columns from the board store', async () => {
    const tool = getTool('list_columns');
    const result = await tool.execute({});
    expect(result).toEqual([
      { id: COL_1, name: 'To Do', wipLimit: null },
      { id: COL_2, name: 'Done', wipLimit: 5 },
    ]);
  });
});

describe('create_card', () => {
  it('creates a card and returns it', async () => {
    const apiCard = { id: 'new-1', boardId: BOARD_ID, columnId: COL_1, swimlaneId: SWIM_1, parentCardId: null, cardType: 'task' as const, title: 'My card', description: null, position: 'a0', dueDate: null, isArchived: false, createdBy: USER_1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
    vi.mocked(cardsApi.createCard).mockResolvedValue(apiCard);
    const tool = getTool('create_card');
    const result = await tool.execute({ title: 'My card', columnId: COL_1 });
    expect(cardsApi.createCard).toHaveBeenCalledWith(BOARD_ID, { title: 'My card', columnId: COL_1 });
    expect(result).toEqual(apiCard);
  });
});

// --- Phase 2 read tools ---

describe('list_cards', () => {
  it('returns all cards when no filters provided', async () => {
    const tool = getTool('list_cards', [makeCard({ id: CARD_1 }), makeCard({ id: CARD_2 })]);
    const result = await tool.execute({}) as { id: string }[];
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toContain(CARD_1);
    expect(result.map((c) => c.id)).toContain(CARD_2);
  });

  it('filters by columnId', async () => {
    const cards = [makeCard({ id: CARD_1, columnId: COL_1 }), makeCard({ id: CARD_2, columnId: COL_2 })];
    const tool = getTool('list_cards', cards);
    const result = await tool.execute({ columnId: COL_1 }) as { id: string }[];
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(CARD_1);
  });

  it('filters by search (case-insensitive)', async () => {
    const cards = [makeCard({ id: CARD_1, title: 'Fix login bug' }), makeCard({ id: CARD_2, title: 'Add profile page' })];
    const tool = getTool('list_cards', cards);
    const result = await tool.execute({ search: 'LOGIN' }) as { id: string }[];
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(CARD_1);
  });

  it('throws on invalid columnId UUID', async () => {
    const tool = getTool('list_cards');
    await expect(tool.execute({ columnId: 'not-a-uuid' }))
      .rejects.toThrow('columnId must be a valid UUID. Use list_columns to get valid column IDs.');
  });

  it('returns [] when board is not loaded', async () => {
    useBoardStore.setState({ board: null, isLoading: true, selectedCardId: null });
    const tool = createBoardWebMCPTools({ boardId: BOARD_ID, teamId: TEAM_ID })
      .find((t) => t.name === 'list_cards')!;
    const result = await tool.execute({});
    expect(result).toEqual([]);
  });
});

describe('list_current_team_members', () => {
  it('returns projected member list', async () => {
    vi.mocked(teamsApi.getTeam).mockResolvedValue({
      id: TEAM_ID, name: 'Team', slug: 'team', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      members: [
        { id: 'mem-1', userId: USER_1, role: 'member' as any, displayName: 'Alice', email: 'alice@example.com', avatarUrl: null },
      ],
    });
    const tool = getTool('list_current_team_members');
    const result = await tool.execute({});
    expect(teamsApi.getTeam).toHaveBeenCalledWith(TEAM_ID);
    expect(result).toEqual([{ id: USER_1, displayName: 'Alice', email: 'alice@example.com' }]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (file doesn't exist)**

```bash
cd /Users/gerrit/Code/trello-clone/apps/web && pnpm vitest run src/hooks/boardWebMCPTools.test.ts
```

Expected: import error (module not found).

- [ ] **Step 3: Create `boardWebMCPTools.ts` with factory — Phase 1 tools + `list_cards` + `list_current_team_members`**

Create `apps/web/src/hooks/boardWebMCPTools.ts`:

```ts
import type { WebMCPTool } from './useWebMCP.js';
import { useBoardStore } from '../stores/boardStore.js';
import * as boardsApi from '../api/boards.api.js';
import * as cardsApi from '../api/cards.api.js';
import * as teamsApi from '../api/teams.api.js';
import type { CardSummary } from '@trello-clone/shared';

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Returns all 10 WebMCP tool definitions for the board page.
 * Plain function — no React hooks. boardId and teamId are closed over.
 */
export function createBoardWebMCPTools(params: {
  boardId: string;
  teamId: string;
}): WebMCPTool[] {
  const { boardId, teamId } = params;

  return [
    // ── Phase 1 tools ──────────────────────────────────────────────────────
    {
      name: 'list_current_team_boards',
      description:
        'List all boards in the current team. Scoped to the team the user is viewing — not all teams.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const boards = await boardsApi.listBoards(teamId);
        return boards.map((b) => ({ id: b.id, name: b.name }));
      },
    },
    {
      name: 'list_columns',
      description:
        'List all columns on the current board with their id, name, and WIP limit. Returns [] if the board is not yet loaded.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const board = useBoardStore.getState().board;
        if (!board) return [];
        return board.columns.map((c) => ({
          id: c.id,
          name: c.name,
          wipLimit: c.wipLimit ?? null,
        }));
      },
    },
    {
      name: 'create_card',
      description:
        'Create a new card on the current board. Use list_columns first to get valid column IDs.',
      inputSchema: {
        type: 'object',
        required: ['title', 'columnId'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 500 },
          columnId: { type: 'string', format: 'uuid', description: 'Use list_columns to get a valid ID.' },
          description: { type: 'string', maxLength: 5000 },
          cardType: { type: 'string', enum: ['story', 'bug', 'task'] },
          swimlaneId: { type: 'string', format: 'uuid' },
        },
      },
      execute: async (input: unknown) => {
        const { title, columnId, description, cardType, swimlaneId } = input as {
          title: string;
          columnId: string;
          description?: string;
          cardType?: 'story' | 'bug' | 'task';
          swimlaneId?: string;
        };

        if (!isUUID(columnId)) {
          throw new Error('columnId must be a valid UUID. Use list_columns to get valid column IDs.');
        }

        const board = useBoardStore.getState().board;
        if (!board) {
          throw new Error('Board is not loaded yet. Please wait and try again.');
        }

        let card;
        try {
          card = await cardsApi.createCard(boardId, {
            title,
            columnId,
            ...(description !== undefined ? { description } : {}),
            ...(cardType !== undefined ? { cardType } : {}),
            ...(swimlaneId !== undefined ? { swimlaneId } : {}),
          });
        } catch (err) {
          const apiErr = err as { response?: { status?: number; data?: { message?: string } } };
          if (
            apiErr.response?.status === 404 &&
            apiErr.response?.data?.message === 'Column not found on this board'
          ) {
            throw new Error('Column not found on this board. Use list_columns to get valid column IDs.');
          }
          throw err;
        }

        const cardSummary: CardSummary = {
          id: card.id,
          columnId: card.columnId,
          swimlaneId: card.swimlaneId,
          parentCardId: card.parentCardId,
          cardType: card.cardType,
          title: card.title,
          position: card.position,
          dueDate: card.dueDate ?? null,
          assignees: [],
          labels: [],
          commentCount: 0,
          subtaskCount: 0,
          subtaskDoneCount: 0,
          attachmentCount: 0,
        };

        useBoardStore.getState().addCard(cardSummary);
        return card;
      },
    },

    // ── Phase 2 read tools ─────────────────────────────────────────────────
    {
      name: 'list_cards',
      description:
        'List cards on the current board. Optional: filter by columnId and/or search text in title.',
      inputSchema: {
        type: 'object',
        properties: {
          columnId: {
            type: 'string',
            format: 'uuid',
            description: 'Filter to this column only. Use list_columns to get valid IDs.',
          },
          search: {
            type: 'string',
            maxLength: 200,
            description: 'Case-insensitive substring match on card title.',
          },
        },
      },
      execute: async (input: unknown) => {
        const { columnId, search } = ((input ?? {}) as { columnId?: string; search?: string });

        if (columnId !== undefined && !isUUID(columnId)) {
          throw new Error('columnId must be a valid UUID. Use list_columns to get valid column IDs.');
        }

        const board = useBoardStore.getState().board;
        if (!board) return [];

        let cards = board.cards;
        if (columnId !== undefined) {
          cards = cards.filter((c) => c.columnId === columnId);
        }
        if (search !== undefined && search.length > 0) {
          const q = search.toLowerCase();
          cards = cards.filter((c) => c.title.toLowerCase().includes(q));
        }

        return cards.map((c) => ({
          id: c.id,
          title: c.title,
          columnId: c.columnId,
          swimlaneId: c.swimlaneId,
          cardType: c.cardType,
          dueDate: c.dueDate,
          assignees: c.assignees,
          labels: c.labels,
          commentCount: c.commentCount,
        }));
      },
    },
    {
      name: 'list_current_team_members',
      description:
        'List members of the current team. Use the returned user IDs with assign_user.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const team = await teamsApi.getTeam(teamId);
        return team.members.map((m) => ({
          id: m.userId,
          displayName: m.displayName,
          email: m.email,
        }));
      },
    },
  ];
}
```

- [ ] **Step 4: Run tests — expect all 10 pass**

```bash
cd /Users/gerrit/Code/trello-clone/apps/web && pnpm vitest run src/hooks/boardWebMCPTools.test.ts
```

Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/boardWebMCPTools.ts apps/web/src/hooks/boardWebMCPTools.test.ts
git commit -m "feat: add boardWebMCPTools factory with Phase 1 migration and list_cards, list_current_team_members"
```

---

### Task 3: Card write tools — `update_card`, `move_card`, `delete_card`

**Files:**
- Modify: `apps/web/src/hooks/boardWebMCPTools.ts` — add 3 tools
- Modify: `apps/web/src/hooks/boardWebMCPTools.test.ts` — add 12 tests

- [ ] **Step 1: Add failing tests to `boardWebMCPTools.test.ts`**

Append the following after the existing `list_current_team_members` describe block:

```ts
// --- Card write tools ---

describe('update_card', () => {
  const apiCard = {
    id: CARD_1, boardId: BOARD_ID, columnId: COL_1, swimlaneId: SWIM_1,
    parentCardId: null, cardType: 'bug' as const, title: 'Updated title',
    description: null, position: 'a0', dueDate: null, isArchived: false,
    createdBy: USER_1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };

  it('updates card and returns it', async () => {
    vi.mocked(cardsApi.updateCard).mockResolvedValue(apiCard);
    const tool = getTool('update_card', [makeCard()]);
    const result = await tool.execute({ cardId: CARD_1, title: 'Updated title', cardType: 'bug' });
    expect(cardsApi.updateCard).toHaveBeenCalledWith(
      BOARD_ID, CARD_1, { title: 'Updated title', cardType: 'bug' },
    );
    expect(result).toEqual(apiCard);
  });

  it('updates store with CardSummary fields from API response', async () => {
    vi.mocked(cardsApi.updateCard).mockResolvedValue(apiCard);
    const tool = getTool('update_card', [makeCard()]);
    await tool.execute({ cardId: CARD_1, title: 'Updated title', cardType: 'bug' });
    const card = useBoardStore.getState().board?.cards.find((c) => c.id === CARD_1);
    expect(card?.title).toBe('Updated title');
    expect(card?.cardType).toBe('bug');
  });

  it('throws on invalid cardId UUID', async () => {
    const tool = getTool('update_card');
    await expect(tool.execute({ cardId: 'not-a-uuid', title: 'x' }))
      .rejects.toThrow('cardId must be a valid UUID. Use list_cards to get valid card IDs.');
  });

  it('throws with recovery hint on 404', async () => {
    vi.mocked(cardsApi.updateCard).mockRejectedValue({ response: { status: 404 } });
    const tool = getTool('update_card', [makeCard()]);
    await expect(tool.execute({ cardId: CARD_1, title: 'x' }))
      .rejects.toThrow('Card not found. Use list_cards to get valid card IDs.');
  });
});

describe('move_card', () => {
  const apiCard = {
    id: CARD_1, boardId: BOARD_ID, columnId: COL_2, swimlaneId: SWIM_1,
    parentCardId: null, cardType: 'task' as const, title: 'Test card',
    description: null, position: 'a0', dueDate: null, isArchived: false,
    createdBy: USER_1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };

  it('moves to top — sends afterId: null', async () => {
    vi.mocked(cardsApi.moveCard).mockResolvedValue(apiCard);
    const tool = getTool('move_card', [makeCard()]);
    await tool.execute({ cardId: CARD_1, columnId: COL_2, position: 'top' });
    expect(cardsApi.moveCard).toHaveBeenCalledWith(
      BOARD_ID, CARD_1, { columnId: COL_2, afterId: null },
    );
  });

  it('moves to bottom — sends last card in target column as afterId', async () => {
    const existingCard = makeCard({ id: CARD_2, columnId: COL_2, swimlaneId: SWIM_1, position: 'a0' });
    vi.mocked(cardsApi.moveCard).mockResolvedValue(apiCard);
    const tool = getTool('move_card', [makeCard(), existingCard]);
    await tool.execute({ cardId: CARD_1, columnId: COL_2, position: 'bottom' });
    expect(cardsApi.moveCard).toHaveBeenCalledWith(
      BOARD_ID, CARD_1, { columnId: COL_2, afterId: CARD_2 },
    );
  });

  it('moves to bottom with afterId: null when target column is empty', async () => {
    vi.mocked(cardsApi.moveCard).mockResolvedValue(apiCard);
    // Only the card being moved exists; COL_2 is empty
    const tool = getTool('move_card', [makeCard()]);
    await tool.execute({ cardId: CARD_1, columnId: COL_2, position: 'bottom' });
    expect(cardsApi.moveCard).toHaveBeenCalledWith(
      BOARD_ID, CARD_1, { columnId: COL_2, afterId: null },
    );
  });

  it('updates store with values from API response', async () => {
    vi.mocked(cardsApi.moveCard).mockResolvedValue(apiCard);
    const tool = getTool('move_card', [makeCard()]);
    await tool.execute({ cardId: CARD_1, columnId: COL_2, position: 'top' });
    const card = useBoardStore.getState().board?.cards.find((c) => c.id === CARD_1);
    expect(card?.columnId).toBe(COL_2);
    expect(card?.swimlaneId).toBe(SWIM_1);
    expect(card?.position).toBe('a0');
  });
});

describe('delete_card', () => {
  it('deletes card and returns { success: true }', async () => {
    vi.mocked(cardsApi.deleteCard).mockResolvedValue(undefined);
    const tool = getTool('delete_card', [makeCard()]);
    const result = await tool.execute({ cardId: CARD_1 });
    expect(cardsApi.deleteCard).toHaveBeenCalledWith(BOARD_ID, CARD_1);
    expect(result).toEqual({ success: true });
  });

  it('removes card from store', async () => {
    vi.mocked(cardsApi.deleteCard).mockResolvedValue(undefined);
    const tool = getTool('delete_card', [makeCard()]);
    await tool.execute({ cardId: CARD_1 });
    expect(useBoardStore.getState().board?.cards).toHaveLength(0);
  });

  it('throws on invalid cardId UUID', async () => {
    const tool = getTool('delete_card');
    await expect(tool.execute({ cardId: 'not-a-uuid' }))
      .rejects.toThrow('cardId must be a valid UUID. Use list_cards to get valid card IDs.');
  });

  it('throws with recovery hint on 404', async () => {
    vi.mocked(cardsApi.deleteCard).mockRejectedValue({ response: { status: 404 } });
    const tool = getTool('delete_card', [makeCard()]);
    await expect(tool.execute({ cardId: CARD_1 }))
      .rejects.toThrow('Card not found. Use list_cards to get valid card IDs.');
  });
});
```

- [ ] **Step 2: Run tests — expect the new ones FAIL**

```bash
cd /Users/gerrit/Code/trello-clone/apps/web && pnpm vitest run src/hooks/boardWebMCPTools.test.ts
```

Expected: 10 existing pass, 12 new fail (tools not yet implemented).

- [ ] **Step 3: Add card write tools to `boardWebMCPTools.ts`**

Add these three tools to the array in `createBoardWebMCPTools`, after the `list_current_team_members` tool. Also add the missing import at the top:

```ts
// Add to existing imports:
import * as assigneesApi from '../api/assignees.api.js';
```

Then append the three tools at the end of the returned array (before the closing `]`):

```ts
    // ── Phase 2 write tools ────────────────────────────────────────────────
    {
      name: 'update_card',
      description:
        'Update fields on a card. Provide at least one of: title, description, cardType, dueDate.',
      inputSchema: {
        type: 'object',
        required: ['cardId'],
        properties: {
          cardId: { type: 'string', format: 'uuid', description: 'Use list_cards to get valid card IDs.' },
          title: { type: 'string', minLength: 1, maxLength: 500 },
          description: { type: 'string', maxLength: 5000, nullable: true },
          cardType: { type: 'string', enum: ['story', 'bug', 'task'] },
          dueDate: { type: 'string', nullable: true, description: 'ISO 8601 datetime or null to clear.' },
        },
      },
      execute: async (input: unknown) => {
        const { cardId, title, description, cardType, dueDate } = input as {
          cardId: string;
          title?: string;
          description?: string | null;
          cardType?: 'story' | 'bug' | 'task';
          dueDate?: string | null;
        };

        if (!isUUID(cardId)) {
          throw new Error('cardId must be a valid UUID. Use list_cards to get valid card IDs.');
        }

        const board = useBoardStore.getState().board;
        if (!board) {
          throw new Error('Board is not loaded yet. Please wait and try again.');
        }

        let card;
        try {
          card = await cardsApi.updateCard(boardId, cardId, {
            ...(title !== undefined ? { title } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(cardType !== undefined ? { cardType } : {}),
            ...(dueDate !== undefined ? { dueDate } : {}),
          });
        } catch (err) {
          const apiErr = err as { response?: { status?: number } };
          if (apiErr.response?.status === 404) {
            throw new Error('Card not found. Use list_cards to get valid card IDs.');
          }
          throw err;
        }

        useBoardStore.getState().updateCard(cardId, {
          title: card.title,
          cardType: card.cardType,
          dueDate: card.dueDate ?? null,
        });

        return card;
      },
    },
    {
      name: 'move_card',
      description:
        'Move a card to a different column. Use "top" or "bottom" for position.',
      inputSchema: {
        type: 'object',
        required: ['cardId', 'columnId', 'position'],
        properties: {
          cardId: { type: 'string', format: 'uuid' },
          columnId: { type: 'string', format: 'uuid', description: 'Use list_columns to get valid IDs.' },
          position: { type: 'string', enum: ['top', 'bottom'] },
          swimlaneId: { type: 'string', format: 'uuid' },
        },
      },
      execute: async (input: unknown) => {
        const { cardId, columnId, position, swimlaneId } = input as {
          cardId: string;
          columnId: string;
          position: 'top' | 'bottom';
          swimlaneId?: string;
        };

        if (!isUUID(cardId)) {
          throw new Error('cardId must be a valid UUID. Use list_cards to get valid card IDs.');
        }
        if (!isUUID(columnId)) {
          throw new Error('columnId must be a valid UUID. Use list_columns to get valid column IDs.');
        }
        if (swimlaneId !== undefined && !isUUID(swimlaneId)) {
          throw new Error('swimlaneId must be a valid UUID.');
        }

        const board = useBoardStore.getState().board;
        if (!board) {
          throw new Error('Board is not loaded yet. Please wait and try again.');
        }

        let afterId: string | null = null;
        if (position === 'bottom') {
          const movingCard = board.cards.find((c) => c.id === cardId);
          const targetSwimlaneId = swimlaneId ?? movingCard?.swimlaneId;
          const colCards = board.cards
            .filter(
              (c) =>
                c.columnId === columnId &&
                (targetSwimlaneId === undefined || c.swimlaneId === targetSwimlaneId) &&
                c.id !== cardId,
            )
            .sort((a, b) => a.position.localeCompare(b.position));
          afterId = colCards.length > 0 ? colCards[colCards.length - 1].id : null;
        }

        const card = await cardsApi.moveCard(boardId, cardId, {
          columnId,
          afterId,
          ...(swimlaneId !== undefined ? { swimlaneId } : {}),
        });

        useBoardStore.getState().moveCard(card.id, card.columnId, card.swimlaneId, card.position);
        return card;
      },
    },
    {
      name: 'delete_card',
      description: 'Delete a card permanently from the board.',
      inputSchema: {
        type: 'object',
        required: ['cardId'],
        properties: {
          cardId: { type: 'string', format: 'uuid', description: 'Use list_cards to get valid card IDs.' },
        },
      },
      execute: async (input: unknown) => {
        const { cardId } = input as { cardId: string };

        if (!isUUID(cardId)) {
          throw new Error('cardId must be a valid UUID. Use list_cards to get valid card IDs.');
        }

        const board = useBoardStore.getState().board;
        if (!board) {
          throw new Error('Board is not loaded yet. Please wait and try again.');
        }

        try {
          await cardsApi.deleteCard(boardId, cardId);
        } catch (err) {
          const apiErr = err as { response?: { status?: number } };
          if (apiErr.response?.status === 404) {
            throw new Error('Card not found. Use list_cards to get valid card IDs.');
          }
          throw err;
        }

        useBoardStore.getState().removeCard(cardId);
        return { success: true };
      },
    },
```

- [ ] **Step 4: Run tests — expect all 22 pass**

```bash
cd /Users/gerrit/Code/trello-clone/apps/web && pnpm vitest run src/hooks/boardWebMCPTools.test.ts
```

Expected: 22 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/boardWebMCPTools.ts apps/web/src/hooks/boardWebMCPTools.test.ts
git commit -m "feat: add update_card, move_card, delete_card WebMCP tools"
```

---

## Chunk 2: Assignee tools and hook refactor

### Task 4: `assign_user` and `unassign_user` tools

**Files:**
- Modify: `apps/web/src/hooks/boardWebMCPTools.ts` — add 2 tools
- Modify: `apps/web/src/hooks/boardWebMCPTools.test.ts` — add 9 tests

- [ ] **Step 1: Add failing tests to `boardWebMCPTools.test.ts`**

Append after the `delete_card` describe block:

```ts
describe('assign_user', () => {
  const assignee = { id: USER_1, displayName: 'Alice', avatarUrl: null };

  it('assigns user and returns the assignee', async () => {
    vi.mocked(assigneesApi.addAssignee).mockResolvedValue(assignee);
    const tool = getTool('assign_user', [makeCard()]);
    const result = await tool.execute({ cardId: CARD_1, userId: USER_1 });
    expect(assigneesApi.addAssignee).toHaveBeenCalledWith(BOARD_ID, CARD_1, USER_1);
    expect(result).toEqual(assignee);
  });

  it('appends assignee to card in store', async () => {
    vi.mocked(assigneesApi.addAssignee).mockResolvedValue(assignee);
    const tool = getTool('assign_user', [makeCard()]);
    await tool.execute({ cardId: CARD_1, userId: USER_1 });
    const card = useBoardStore.getState().board?.cards.find((c) => c.id === CARD_1);
    expect(card?.assignees).toEqual([assignee]);
  });

  it('is idempotent — returns existing assignee from store when API returns 409', async () => {
    vi.mocked(assigneesApi.addAssignee).mockRejectedValue({ response: { status: 409 } });
    const tool = getTool('assign_user', [makeCard({ assignees: [assignee] })]);
    const result = await tool.execute({ cardId: CARD_1, userId: USER_1 });
    expect(result).toEqual(assignee);
  });

  it('throws on invalid cardId UUID', async () => {
    const tool = getTool('assign_user');
    await expect(tool.execute({ cardId: 'not-a-uuid', userId: USER_1 }))
      .rejects.toThrow('cardId must be a valid UUID. Use list_cards to get valid card IDs.');
  });

  it('throws on invalid userId UUID', async () => {
    const tool = getTool('assign_user');
    await expect(tool.execute({ cardId: CARD_1, userId: 'not-a-uuid' }))
      .rejects.toThrow('userId must be a valid UUID. Use list_current_team_members to get valid user IDs.');
  });
});

describe('unassign_user', () => {
  const assignee = { id: USER_1, displayName: 'Alice', avatarUrl: null };

  it('unassigns user and returns { success: true }', async () => {
    vi.mocked(assigneesApi.removeAssignee).mockResolvedValue(undefined);
    const tool = getTool('unassign_user', [makeCard({ assignees: [assignee] })]);
    const result = await tool.execute({ cardId: CARD_1, userId: USER_1 });
    expect(assigneesApi.removeAssignee).toHaveBeenCalledWith(BOARD_ID, CARD_1, USER_1);
    expect(result).toEqual({ success: true });
  });

  it('removes assignee from card in store', async () => {
    vi.mocked(assigneesApi.removeAssignee).mockResolvedValue(undefined);
    const tool = getTool('unassign_user', [makeCard({ assignees: [assignee] })]);
    await tool.execute({ cardId: CARD_1, userId: USER_1 });
    const card = useBoardStore.getState().board?.cards.find((c) => c.id === CARD_1);
    expect(card?.assignees).toEqual([]);
  });

  it('throws on invalid cardId UUID', async () => {
    const tool = getTool('unassign_user');
    await expect(tool.execute({ cardId: 'not-a-uuid', userId: USER_1 }))
      .rejects.toThrow('cardId must be a valid UUID. Use list_cards to get valid card IDs.');
  });

  it('throws on invalid userId UUID', async () => {
    const tool = getTool('unassign_user');
    await expect(tool.execute({ cardId: CARD_1, userId: 'not-a-uuid' }))
      .rejects.toThrow('userId must be a valid UUID. Use list_current_team_members to get valid user IDs.');
  });
});
```

- [ ] **Step 2: Run tests — expect the new 5 FAIL**

```bash
cd /Users/gerrit/Code/trello-clone/apps/web && pnpm vitest run src/hooks/boardWebMCPTools.test.ts
```

Expected: 22 existing pass, 9 new fail.

- [ ] **Step 3: Add `assign_user` and `unassign_user` to `boardWebMCPTools.ts`**

Append after the `delete_card` tool (before the closing `]`). The `assigneesApi` import was added in Task 3:

```ts
    {
      name: 'assign_user',
      description:
        'Assign a team member to a card. Use list_current_team_members to get valid user IDs.',
      inputSchema: {
        type: 'object',
        required: ['cardId', 'userId'],
        properties: {
          cardId: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
        },
      },
      execute: async (input: unknown) => {
        const { cardId, userId } = input as { cardId: string; userId: string };

        if (!isUUID(cardId)) {
          throw new Error('cardId must be a valid UUID. Use list_cards to get valid card IDs.');
        }
        if (!isUUID(userId)) {
          throw new Error('userId must be a valid UUID. Use list_current_team_members to get valid user IDs.');
        }

        let assignee;
        try {
          assignee = await assigneesApi.addAssignee(boardId, cardId, userId);
        } catch (err) {
          const apiErr = err as { response?: { status?: number } };
          if (apiErr.response?.status === 409) {
            // Already assigned — silently succeed, return existing from store (idempotent).
            // In normal operation the assignee is always present in the store on 409.
            const card = useBoardStore.getState().board?.cards.find((c) => c.id === cardId);
            const existing = card?.assignees.find((a) => a.id === userId);
            if (existing) return existing;
          }
          throw err;
        }

        const board = useBoardStore.getState().board;
        if (board) {
          const card = board.cards.find((c) => c.id === cardId);
          if (card && !card.assignees.some((a) => a.id === assignee.id)) {
            useBoardStore.getState().updateCard(cardId, {
              assignees: [...card.assignees, assignee],
            });
          }
        }

        return assignee;
      },
    },
    {
      name: 'unassign_user',
      description: 'Remove a team member from a card.',
      inputSchema: {
        type: 'object',
        required: ['cardId', 'userId'],
        properties: {
          cardId: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
        },
      },
      execute: async (input: unknown) => {
        const { cardId, userId } = input as { cardId: string; userId: string };

        if (!isUUID(cardId)) {
          throw new Error('cardId must be a valid UUID. Use list_cards to get valid card IDs.');
        }
        if (!isUUID(userId)) {
          throw new Error('userId must be a valid UUID. Use list_current_team_members to get valid user IDs.');
        }

        await assigneesApi.removeAssignee(boardId, cardId, userId);

        const board = useBoardStore.getState().board;
        if (board) {
          const card = board.cards.find((c) => c.id === cardId);
          if (card) {
            useBoardStore.getState().updateCard(cardId, {
              assignees: card.assignees.filter((a) => a.id !== userId),
            });
          }
        }

        return { success: true };
      },
    },
```

- [ ] **Step 4: Run tests — expect all 26 pass**

```bash
cd /Users/gerrit/Code/trello-clone/apps/web && pnpm vitest run src/hooks/boardWebMCPTools.test.ts
```

Expected: 31 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/boardWebMCPTools.ts apps/web/src/hooks/boardWebMCPTools.test.ts
git commit -m "feat: add assign_user and unassign_user WebMCP tools"
```

---

### Task 5: Refactor `useBoardWebMCP` to thin wrapper and update its test

**Files:**
- Modify: `apps/web/src/hooks/useBoardWebMCP.ts` — replace body with factory delegation
- Modify: `apps/web/src/hooks/useBoardWebMCP.test.ts` — replace per-tool tests with single registration test

- [ ] **Step 1: Write the new test for `useBoardWebMCP.test.ts`**

Replace the entire contents of `apps/web/src/hooks/useBoardWebMCP.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import React from 'react';
import { useBoardWebMCP } from './useBoardWebMCP.js';
import { useBoardStore } from '../stores/boardStore.js';
import type { BoardDetail } from '../api/boards.api.js';

vi.mock('../api/boards.api.js', () => ({ listBoards: vi.fn() }));
vi.mock('../api/cards.api.js', () => ({
  createCard: vi.fn(),
  updateCard: vi.fn(),
  moveCard: vi.fn(),
  deleteCard: vi.fn(),
}));
vi.mock('../api/assignees.api.js', () => ({
  addAssignee: vi.fn(),
  removeAssignee: vi.fn(),
}));
vi.mock('../api/teams.api.js', () => ({ getTeam: vi.fn() }));

const TEAM_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const BOARD_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const makeBoard = (): BoardDetail => ({
  id: BOARD_ID, teamId: TEAM_ID, name: 'Board', description: null,
  createdBy: 'u', isArchived: false,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  columns: [], swimlanes: [], cards: [], labels: [],
});

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(
    MemoryRouter, { initialEntries: [`/teams/${TEAM_ID}/boards/${BOARD_ID}`] },
    React.createElement(Routes, null,
      React.createElement(Route, {
        path: '/teams/:teamId/boards/:boardId',
        element: React.createElement(React.Fragment, null, children),
      }),
    ),
  );

const registerTool = vi.fn();
const unregisterTool = vi.fn();

beforeEach(() => {
  registerTool.mockClear();
  unregisterTool.mockClear();
  Object.defineProperty(navigator, 'modelContext', {
    value: { registerTool, unregisterTool },
    writable: true,
    configurable: true,
  });
  useBoardStore.setState({ board: makeBoard(), isLoading: false, selectedCardId: null });
});

afterEach(() => {
  Object.defineProperty(navigator, 'modelContext', {
    value: undefined,
    writable: true,
    configurable: true,
  });
});

describe('useBoardWebMCP', () => {
  it('registers exactly 10 tools via navigator.modelContext', () => {
    renderHook(() => useBoardWebMCP(), { wrapper });
    expect(registerTool).toHaveBeenCalledTimes(10);
    const names = (registerTool.mock.calls as [{ name: string }][]).map((c) => c[0].name);
    expect(names).toEqual(
      expect.arrayContaining([
        'list_current_team_boards',
        'list_columns',
        'create_card',
        'list_cards',
        'list_current_team_members',
        'update_card',
        'move_card',
        'delete_card',
        'assign_user',
        'unassign_user',
      ]),
    );
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL (useBoardWebMCP still has old body)**

```bash
cd /Users/gerrit/Code/trello-clone/apps/web && pnpm vitest run src/hooks/useBoardWebMCP.test.ts
```

Expected: the "registers exactly 10 tools" test FAILS (only 3 tools registered with old code).

- [ ] **Step 3: Replace `useBoardWebMCP.ts` body**

Replace the entire contents of `apps/web/src/hooks/useBoardWebMCP.ts` with:

```ts
import { useParams } from 'react-router';
import { createBoardWebMCPTools } from './boardWebMCPTools.js';
import { useWebMCP } from './useWebMCP.js';

/**
 * Registers all WebMCP tools for the board page.
 * Only call this from BoardPage — it assumes teamId and boardId are in the URL.
 */
export function useBoardWebMCP(): void {
  const { teamId, boardId } = useParams<{ teamId: string; boardId: string }>();
  const tools = createBoardWebMCPTools({ boardId: boardId!, teamId: teamId! });
  useWebMCP(tools);
}
```

- [ ] **Step 4: Run all web tests — expect all pass**

```bash
cd /Users/gerrit/Code/trello-clone/apps/web && pnpm vitest run
```

Expected: all tests pass. Test count breakdown:
- `boardStore.test.ts`: 3
- `useWebMCP.test.ts`: 4
- `boardWebMCPTools.test.ts`: 31
- `useBoardWebMCP.test.ts`: 1
Total: 39

- [ ] **Step 5: Run full suite**

```bash
cd /Users/gerrit/Code/trello-clone && pnpm test
```

Expected: all tests pass (286 API + 39 web = 325 total).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/useBoardWebMCP.ts apps/web/src/hooks/useBoardWebMCP.test.ts
git commit -m "refactor: replace useBoardWebMCP body with createBoardWebMCPTools factory delegation"
```
