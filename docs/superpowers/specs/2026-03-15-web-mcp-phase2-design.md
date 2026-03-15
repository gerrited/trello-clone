# WebMCP Phase 2 Design

**Date:** 2026-03-15
**Status:** Draft
**Scope:** Phase 2 — `list_cards`, `update_card`, `move_card`, `delete_card`, `assign_user`, `unassign_user`, `list_current_team_members`

---

## Background

Phase 1 shipped three creation-focused WebMCP tools (`list_current_team_boards`, `list_columns`, `create_card`) in `apps/web/src/hooks/useBoardWebMCP.ts`. Phase 2 adds seven more tools covering card mutation, deletion, listing, and assignee management.

WebMCP uses the imperative API: `navigator.modelContext.registerTool()`. See the Phase 1 spec for background on the WebMCP browser API.

---

## Goal

Allow an AI agent to list, update, move, delete cards, and manage assignees on a board via natural language chat.

---

## Architecture

### File changes

```
apps/web/src/hooks/boardWebMCPTools.ts        New — factory fn createBoardWebMCPTools({ boardId, teamId }) returns all 10 tools
apps/web/src/hooks/boardWebMCPTools.test.ts   New — unit tests for all Phase 2 tools (factory called directly, no renderHook)
apps/web/src/hooks/useBoardWebMCP.ts          Refactor — thin wrapper: useParams → createBoardWebMCPTools → useWebMCP
apps/web/src/hooks/useBoardWebMCP.test.ts     Update — verify hook registers exactly 10 tools via navigator.modelContext
apps/web/src/api/assignees.api.ts             New — addAssignee, removeAssignee
```

A `teamsApi.getTeam(teamId)` call is needed for `list_current_team_members`. Check whether `apps/web/src/api/teams.api.ts` already exists before creating it; if the function is absent, add `getTeam` to that file or create it.

### Factory pattern

`createBoardWebMCPTools` is a plain function (no React hooks). It closes over `boardId` and `teamId` and returns an array of `WebMCPTool` definitions. All `execute` functions access the store synchronously via `useBoardStore.getState()` at call time — not at factory creation time.

```ts
// boardWebMCPTools.ts
export function createBoardWebMCPTools(params: {
  boardId: string;
  teamId: string;
}): WebMCPTool[] { ... }
```

```ts
// useBoardWebMCP.ts (after refactor — ~15 lines)
export function useBoardWebMCP(): void {
  const { teamId, boardId } = useParams<{ teamId: string; boardId: string }>();
  const tools = createBoardWebMCPTools({ boardId: boardId!, teamId: teamId! });
  useWebMCP(tools);
}
```

The Phase 1 tools (`list_current_team_boards`, `list_columns`, `create_card`) move into `boardWebMCPTools.ts` alongside the Phase 2 tools. `useBoardWebMCP.ts` becomes a thin hook wrapper.

---

## New API module: `assignees.api.ts`

```ts
// apps/web/src/api/assignees.api.ts

import { client } from './client.js';

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
  const res = await client.post<Assignee>(
    `/boards/${boardId}/cards/${cardId}/assignees`,
    { userId },
  );
  return res.data;
}

export async function removeAssignee(
  boardId: string,
  cardId: string,
  userId: string,
): Promise<void> {
  await client.delete(`/boards/${boardId}/cards/${cardId}/assignees/${userId}`);
}
```

---

## Tools

### Phase 1 tools (moved, unchanged)

`list_current_team_boards`, `list_columns`, `create_card` — moved to `boardWebMCPTools.ts` with no behaviour changes.

---

### `list_cards`

Returns cards on the current board. Reads from `boardStore` — no API call.

- **Input schema:**

  | Field | Type | Constraints | Required |
  |---|---|---|---|
  | `columnId` | `string` | UUID format | No |
  | `search` | `string` | max 200 chars | No |

- **Output:** `Array<{ id, title, columnId, swimlaneId, cardType, dueDate, assignees: [{ id, displayName }], labels: [{ id, name, color }], commentCount }>`
- **Filtering:** `columnId` filter applied first (exact match), then `search` (case-insensitive substring match on `title`). Both are independent and composable.
- **Returns `[]`** if board is not loaded or no cards match.
- **Pre-validates** `columnId` as UUID if provided; throws `Error("columnId must be a valid UUID. Use list_columns to get valid column IDs.")`.

---

### `update_card`

Updates fields on an existing card.

- **Input schema:**

  | Field | Type | Constraints | Required |
  |---|---|---|---|
  | `cardId` | `string` | UUID format | Yes |
  | `title` | `string` | min 1, max 500 chars | No |
  | `description` | `string \| null` | max 5000 chars | No |
  | `cardType` | `"story" \| "bug" \| "task"` | — | No |
  | `dueDate` | `string \| null` | ISO 8601 datetime | No |

  At least one of `title`, `description`, `cardType`, `dueDate` must be provided (enforced at runtime, not schema level).

- **Output:** raw `Card` from `cardsApi.updateCard`
- **Payload:** only fields explicitly provided are sent (same `!== undefined` spread pattern as Phase 1).
- **Store update:** `useBoardStore.getState().updateCard(cardId, { ...fieldsInCardSummary })` — only `title`, `cardType`, `dueDate` exist in `CardSummary`; `description` is omitted from the store update.
- **`isArchived` and `parentCardId`** are intentionally excluded — archiving and subtask reparenting are out of scope for Phase 2.

---

### `move_card`

Moves a card to a different column, optionally a different swimlane, at the top or bottom of the target column.

- **Input schema:**

  | Field | Type | Constraints | Required |
  |---|---|---|---|
  | `cardId` | `string` | UUID format | Yes |
  | `columnId` | `string` | UUID format | Yes |
  | `position` | `"top" \| "bottom"` | — | Yes |
  | `swimlaneId` | `string` | UUID format | No |

- **Output:** raw `Card`
- **Position resolution:**
  - `"top"` → omit `afterId` (server places card first in the column).
  - `"bottom"` → read cards from `useBoardStore.getState().board.cards`, filter to the target `columnId` and `swimlaneId` (if provided; otherwise the card's current swimlane), sort by `position` lexicographically, take the last card's `id` as `afterId`. If the column is empty, omit `afterId` (same as top).
- **Store update:** `useBoardStore.getState().moveCard(card.id, card.columnId, card.swimlaneId, card.position)` using values from the API response.

---

### `delete_card`

Permanently deletes a card from the board.

- **Input schema:**

  | Field | Type | Constraints | Required |
  |---|---|---|---|
  | `cardId` | `string` | UUID format | Yes |

- **Output:** `{ success: true }`
- **Store update:** `useBoardStore.getState().removeCard(cardId)`

---

### `list_current_team_members`

Returns members of the team the user is currently viewing. Useful for discovering user IDs before calling `assign_user`.

- **Input schema:** `{}` (no parameters)
- **Output:** `Array<{ id, displayName, email }>`
- **Calls:** `teamsApi.getTeam(teamId)`, maps `team.members` to `{ id: m.userId, displayName: m.displayName, email: m.email }`

---

### `assign_user`

Assigns a team member to a card.

- **Input schema:**

  | Field | Type | Constraints | Required |
  |---|---|---|---|
  | `cardId` | `string` | UUID format | Yes |
  | `userId` | `string` | UUID format | Yes |

- **Output:** `{ id, displayName, avatarUrl }`
- **Calls:** `assigneesApi.addAssignee(boardId, cardId, userId)`
- **Store update:** read current card from `useBoardStore.getState().board.cards`, append the returned assignee if not already present (check by `id`), call `useBoardStore.getState().updateCard(cardId, { assignees: updatedArray })`.

---

### `unassign_user`

Removes a team member from a card.

- **Input schema:**

  | Field | Type | Constraints | Required |
  |---|---|---|---|
  | `cardId` | `string` | UUID format | Yes |
  | `userId` | `string` | UUID format | Yes |

- **Output:** `{ success: true }`
- **Calls:** `assigneesApi.removeAssignee(boardId, cardId, userId)`
- **Store update:** filter `userId` out of the card's `assignees` array; call `useBoardStore.getState().updateCard(cardId, { assignees: filteredArray })`.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `cardId` / `columnId` / `swimlaneId` / `userId` not a valid UUID | Pre-validate; throw `Error("<field> must be a valid UUID. Use list_cards to get valid card IDs.")` |
| `update_card` / `delete_card` with cardId not on board (404) | Throw `Error("Card not found. Use list_cards to get valid card IDs.")` |
| `move_card` 404 | Re-throw with original message |
| `assign_user` user not a team member (API 422 or 404) | Re-throw with original message |
| Board not loaded (`boardStore.board` is null) for read operations | Return `[]` |
| Board not loaded for write operations | Throw `Error("Board is not loaded yet. Please wait and try again.")` |
| 403 on any tool | Re-throw with original message |
| Other API errors | Re-throw with original message |

---

## Testing

### `boardWebMCPTools.test.ts` (new, ~20 tests)

Tests all Phase 2 tools by calling `createBoardWebMCPTools({ boardId, teamId })` directly — no `renderHook` required. Mock strategy:

- `vi.mock` for `cardsApi`, `assigneesApi`, `teamsApi`
- `useBoardStore.setState()` to inject board state

Tests per tool:

| Tool | Tests |
|---|---|
| `list_cards` | returns all cards; filters by columnId; filters by search (case-insensitive); throws on invalid columnId UUID; returns [] when board not loaded |
| `update_card` | updates card and returns it; updates store with CardSummary fields; throws on invalid UUID; throws 404 with recovery hint |
| `move_card` | moves to top (no afterId); moves to bottom (uses last card as afterId); handles empty target column (no afterId); updates store from response |
| `delete_card` | deletes card; removes from store; throws on invalid UUID; throws 404 with recovery hint |
| `list_current_team_members` | returns projected member list |
| `assign_user` | assigns user; appends to store assignees; idempotent (no duplicate if already assigned) |
| `unassign_user` | unassigns user; filters from store assignees |

### `useBoardWebMCP.test.ts` (updated)

Replace per-tool execute tests with a single test: render the hook, verify `registerTool` was called exactly 10 times with the correct tool names.

### No E2E tests

Same rationale as Phase 1 — WebMCP requires Chrome 146+ behind a flag.

---

## Out of Scope (Phase 2)

- `isArchived` toggle on `update_card`
- `parentCardId` reparenting
- `create_column`, `assign_label`
- `outputSchema` in tool definitions
- Declarative API
