# WebMCP Integration Design

**Date:** 2026-03-15
**Status:** Approved
**Scope:** Phase 1 — creation-focused tools (`create_card`, `list_boards`, `list_columns`)

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

Three new files, one edit to an existing file:

```
apps/web/src/hooks/useWebMCP.ts           Generic hook — registers/unregisters tools
apps/web/src/hooks/useBoardWebMCP.ts      Board-specific — defines the 3 tools
apps/web/src/types/webmcp.d.ts            TypeScript ambient declaration for navigator.modelContext
apps/web/src/features/boards/BoardPage.tsx  Call useBoardWebMCP() here (one line added)
```

### `useWebMCP.ts`

Generic React hook. Accepts an array of tool definitions. On mount, calls `navigator.modelContext.registerTool()` for each tool. On unmount, calls `navigator.modelContext.unregisterTool()` for each. If `'modelContext' in navigator` is false (unsupported browser or flag disabled), the hook is a no-op — no errors, no console noise.

```ts
interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: object;        // JSON Schema
  outputSchema?: object;      // JSON Schema (optional)
  execute: (input: unknown) => Promise<unknown>;
}

function useWebMCP(tools: WebMCPTool[]): void
```

### `useBoardWebMCP.ts`

Board-specific hook. Reads `boardId` and `teamId` from React Router URL params, reads columns from `boardStore` (already loaded). Defines three tools and passes them to `useWebMCP`.

### Tools

| Tool | Input schema | Behaviour |
|---|---|---|
| `list_boards` | `{}` | Calls `boardsApi.listBoards(teamId)`, returns `Array<{ id, name }>` |
| `list_columns` | `{}` | Reads columns from `boardStore` (no API call), returns `Array<{ id, name, wipLimit }>` |
| `create_card` | `{ title: string, columnId: string, description?: string, cardType?: 'story'\|'bug'\|'task', swimlaneId?: string }` | Calls `cardsApi.createCard(boardId, input)`, dispatches `addCard` to `boardStore`, returns created card |

`swimlaneId` is optional in the tool input. If omitted, the default swimlane (`board.swimlanes.find(s => s.isDefault)`) is used automatically. This prevents the agent from needing to know about swimlanes for the common case.

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
5. On success: structured JSON result is returned to the agent
6. On failure: `Error` is thrown with a descriptive message enabling agent self-correction (e.g. `"Column not found. Use list_columns to get valid column IDs."`)

For `create_card`, the created card is also dispatched to `boardStore` via `addCard` so it appears on the board immediately, without waiting for the WebSocket event.

---

## Error Handling

- **Invalid `columnId`**: throw `Error("Column not found. Use list_columns to get valid column IDs.")`
- **Missing default swimlane**: throw `Error("No default swimlane found on this board.")`
- **API errors**: re-throw with original message
- **Unsupported browser**: `useWebMCP` no-ops silently

---

## Testing

| File | What it tests |
|---|---|
| `apps/web/src/hooks/useWebMCP.test.ts` | `registerTool` called on mount; `unregisterTool` called on unmount; no-op when `navigator.modelContext` absent |
| `apps/web/src/hooks/useBoardWebMCP.test.ts` | Each tool's `execute` function: correct inputs passed, correct outputs returned, descriptive errors on failure |

No E2E tests — WebMCP requires Chrome 146+ behind a flag, making CI coverage impractical. Unit tests cover all logic.

---

## Out of Scope (Phase 1)

The following are saved for later phases:

- `update_card`, `move_card`, `delete_card`
- `create_column`, `assign_label`, `assign_user`
- `list_cards` / search
- Declarative API (`toolname` / `tooldescription` HTML attributes on forms)
