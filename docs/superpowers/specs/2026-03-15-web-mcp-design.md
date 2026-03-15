# WebMCP Integration Design

**Date:** 2026-03-15
**Status:** Approved
**Scope:** Phase 1 — creation-focused tools (`create_card`, `list_current_team_boards`, `list_columns`)

---

## Background

WebMCP is a browser-native API (Chrome 146+, co-developed by Google and Microsoft, W3C incubated) that lets a web app register structured tools AI agents can discover and invoke directly in the browser tab. The browser mediates between the agent and the page: tools run in the page's JavaScript environment using the user's existing authenticated session. No separate server is required.

This is distinct from the standard Model Context Protocol (MCP), which handles server-to-agent communication. WebMCP is specifically designed for human-supervised, browser-based interactions.

WebMCP uses the imperative API: `navigator.modelContext.registerTool()`.

---

## Goal

Allow an AI agent (e.g. Gemini via the Model Context Tool Inspector Extension, or any WebMCP-compatible client) to create one or more cards on a trello-clone board via natural language chat, using the board page as context.

---

## Architecture

Three new files, one edit to an existing file, one edit to `boardStore`:

```
apps/web/src/hooks/useWebMCP.ts              Generic hook — registers/unregisters tools
apps/web/src/hooks/useBoardWebMCP.ts         Board-specific — defines the 3 tools
apps/web/src/types/webmcp.d.ts               TypeScript ambient declaration for navigator.modelContext
apps/web/src/features/boards/BoardPage.tsx   Call useBoardWebMCP() here (one line added)
apps/web/src/stores/boardStore.ts            Add deduplication guard to addCard
```

### `useWebMCP.ts`

Generic React hook. Accepts an array of tool definitions. On mount, calls `navigator.modelContext.registerTool()` for each tool. On unmount, calls `navigator.modelContext.unregisterTool()` for each. If `'modelContext' in navigator` is false (unsupported browser or flag disabled), the hook is a no-op — no errors, no console noise.

The hook registers tools on mount and unregisters them on unmount. It does **not** react to changes in the `tools` array after mount — the tools are captured via `useRef` on first render. If the tool definitions need to change, the host component must be remounted (e.g. via a `key` prop change).

```ts
interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: object;   // JSON Schema
  // outputSchema intentionally omitted in Phase 1; deferred to a later phase
  // once the WebMCP spec stabilises around structured output discovery.
  execute: (input: unknown) => Promise<unknown>;
}

function useWebMCP(tools: WebMCPTool[]): void
```

### `useBoardWebMCP.ts`

Board-specific hook. Reads `boardId` and `teamId` from React Router URL params. Reads columns from `boardStore` (already loaded when the board page is open). Assumes it is only called from `BoardPage` — both params are always present in that route.

Defines three tools as constants and passes them to `useWebMCP`.

### `boardStore.ts` — `addCard` deduplication guard

Add a guard to `addCard` before pushing: `if (state.board.cards.some(c => c.id === card.id)) return;`

This is required because the WebMCP `create_card` tool calls `addCard` after the API resolves (no `X-Socket-Id` is sent, so the server broadcasts `CARD_CREATED` back to the same socket). Without the guard, the card would appear twice. The guard also benefits any future scenario where a card arrives via WebSocket while already present in the store.

> **Note on existing type inconsistency:** `useRealtimeBoard` types the `CARD_CREATED` payload as `{ card: CardSummary }`, but the server broadcasts the raw `Card` DB row (which lacks derived fields like `assignees`, `labels`, `commentCount`). This inconsistency predates this feature. The deduplication guard compares by `card.id`, which exists on both types — the guard is correct regardless of the payload shape.

### Tools

#### `list_current_team_boards`

Returns boards for the team the user is currently viewing. Scoped to `teamId` from the current URL — this is always the active team, not all teams the user belongs to.

- **Input schema:** `{}` (no parameters)
- **Output returned to agent:** `Array<{ id: string, name: string }>` — the `execute` function explicitly projects to this shape (does not return the full `Board` object)
- **Calls:** `boardsApi.listBoards(teamId)` then maps to `{ id, name }`

#### `list_columns`

Returns columns for the current board. Reads from `boardStore` — no API call.

- **Input schema:** `{}` (no parameters)
- **Output:** `Array<{ id: string, name: string, wipLimit: number | null }>`
- **Note:** Returns `[]` if board is not yet loaded.

#### `create_card`

Creates a card in the specified column of the current board.

- **Scoped to:** `boardId` from the current URL — the agent does not provide this.
- **Input schema:**

  | Field | Type | Constraints | Required |
  |---|---|---|---|
  | `title` | `string` | min 1, max 500 chars | Yes |
  | `columnId` | `string` | UUID format | Yes |
  | `description` | `string` | max 5000 chars | No |
  | `cardType` | `"story" \| "bug" \| "task"` | — | No |
  | `swimlaneId` | `string` | UUID format | No |

- **`swimlaneId` handling:** Passed through to the API if provided; omitted if not (identical to `AddCardForm`: `...(swimlaneId ? { swimlaneId } : {})`). The server resolves the default swimlane when `swimlaneId` is absent. The client does not duplicate this logic.
- **Output returned to agent:** The raw `Card` object from `cardsApi.createCard`. Fields: `id`, `boardId`, `columnId`, `swimlaneId`, `title`, `description`, `cardType`, `position`, `dueDate`, `isArchived`, `createdBy`, `createdAt`, `updatedAt`. Does not include derived fields (`assignees`, `labels`, `commentCount`, etc.).
- **Store update:** After the API resolves, calls `addCard` with a `CardSummary` constructed from the `Card` with derived fields set to empty/zero defaults — the same pattern as `AddCardForm`. The `addCard` deduplication guard (described above) prevents a duplicate when the `CARD_CREATED` WebSocket event arrives.

### `BoardPage.tsx`

One call added near the top of the component:

```ts
useBoardWebMCP();
```

---

## Data Flow

1. AI agent discovers available tools on the page via `navigator.modelContext`
2. Agent invokes a tool (e.g. `create_card`) with structured JSON input
3. Browser calls the registered `execute()` function in the page's JS environment
4. The function uses the existing `client.ts` fetch wrapper — the user's `Authorization` header is sent automatically
5. On success: structured result is returned to the agent
6. On failure: `Error` is thrown with a descriptive message enabling agent self-correction

For `create_card` specifically: the tool calls `addCard` after the API resolves (post-resolution store update, same sequencing as `AddCardForm`). The API also broadcasts `CARD_CREATED` back to the current socket (no `X-Socket-Id` exclusion). The `addCard` deduplication guard prevents a duplicate when the WS event arrives. If the socket is temporarily disconnected, the post-resolution store update ensures the card still appears on the board.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Malformed `columnId` (not a valid UUID) | Client pre-validates UUID format before calling API; throws `Error("columnId must be a valid UUID. Use list_columns to get valid column IDs.")` |
| Well-formed `columnId` not found on this board | API returns 404; re-throw with `"Column not found on this board. Use list_columns to get valid column IDs."` |
| Caller-supplied `swimlaneId` is invalid | Not pre-validated client-side. API returns 404; re-thrown with original message. Only `columnId` is pre-validated because `list_columns` gives the agent a recovery path; no equivalent `list_swimlanes` tool exists in Phase 1. |
| Board not loaded (`boardStore.board` is null) | Throw `Error("Board is not loaded yet. Please wait and try again.")` |
| Read-only board (user lacks edit permission) | API returns 403; re-throw with original message. The tool is registered regardless — the API is the authoritative permission check. |
| Other API errors | Re-throw with original message |
| Unsupported browser (no `navigator.modelContext`) | `useWebMCP` no-ops silently |

---

## Testing

| File | What it tests |
|---|---|
| `apps/web/src/hooks/useWebMCP.test.ts` | `registerTool` called on mount for each tool; `unregisterTool` called on unmount; no-op when `navigator.modelContext` absent |
| `apps/web/src/hooks/useBoardWebMCP.test.ts` | Each tool's `execute` function: correct inputs passed, correct outputs returned, descriptive errors on failure, null-board guard, UUID pre-validation for `create_card`. Mock strategy: `vi.mock` for `cardsApi` and `boardsApi`; `useBoardStore.setState()` to inject board state. |
| `apps/web/src/stores/boardStore.test.ts` | New test for the `addCard` deduplication guard: calling `addCard` twice with the same card ID results in exactly one card in the store. |

No E2E tests — WebMCP requires Chrome 146+ behind a flag, making CI coverage impractical. Unit tests cover all logic.

---

## Out of Scope (Phase 1)

The following are saved for later phases:

- `update_card`, `move_card`, `delete_card`
- `create_column`, `assign_label`, `assign_user`
- `list_cards` / search
- Declarative API (`toolname` / `tooldescription` HTML attributes on forms)
- `outputSchema` in tool definitions (deferred until WebMCP spec stabilises around structured output discovery; the returned object shapes are documented in prose under each tool above)
