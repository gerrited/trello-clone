# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
pnpm dev              # Start all services in parallel (API on :3001, Web on :5173)
pnpm build            # Build all packages
pnpm lint             # Lint all packages
pnpm test             # Run all tests
```

### Individual apps
```bash
cd apps/api && pnpm dev      # API only (tsx watch)
cd apps/web && pnpm dev      # Frontend only (vite)
```

### Running a single test file
```bash
cd apps/api && pnpm vitest run src/modules/boards/boards.service.test.ts
cd apps/web && pnpm vitest run src/path/to/test.ts
```

### Database
```bash
pnpm db:generate    # Generate Drizzle migration files from schema changes
pnpm db:migrate     # Apply migrations to the database
pnpm db:seed        # Seed database with initial data
```

### Environment
The `.env` file lives at the **monorepo root**. The API loads it from `../../../../.env` relative to `apps/api/src/config/`. Required variables: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`. See README.md for the full list.

## Architecture

### Monorepo Layout
```
apps/api/       Express 5 + Socket.io backend
apps/web/       React 19 + Vite frontend
packages/shared/ Shared TypeScript types, Zod schemas, and WS_EVENTS constants
```

The `packages/shared` package is consumed by both apps as `@trello-clone/shared`. All shared types and validation schemas live here — don't duplicate them in app-specific code.

### Backend (`apps/api`)

**Module structure** — each feature follows the same pattern:
- `*.routes.ts` — Express route definitions, applies `requireAuth` middleware
- `*.controller.ts` — Parses/validates request, calls service, returns response
- `*.service.ts` — Business logic and DB queries via Drizzle ORM

**Database** — Drizzle ORM with PostgreSQL. Schema is the single source of truth at `apps/api/src/db/schema.ts`. All tables use UUIDs. Card/column/swimlane ordering uses fractional indexing (string positions, lexicographic sort).

**Auth** — JWT access tokens (short-lived, sent as `Authorization: Bearer`) + refresh tokens stored in DB. `requireAuth` middleware in `apps/api/src/middleware/auth.ts` populates `req.userId`. OAuth via Passport.js (Google, Microsoft).

**WebSocket** — Socket.io initialized in `apps/api/src/ws/socket.ts`. Clients authenticate via JWT in `socket.handshake.auth.token`. Rooms: `board:{boardId}` for board updates, `user:{userId}` for notifications. Use `broadcastToBoard()` and `emitToUser()` from `apps/api/src/ws/emitters.ts` to emit from services/controllers. Pass `req.socketId` (from `X-Socket-Id` header) to exclude the sender from broadcasts.

**Error handling** — Throw `AppError(statusCode, message)` from anywhere; the global error handler in `apps/api/src/middleware/error.ts` catches it. ZodErrors are also caught and returned as 400.

### Frontend (`apps/web`)

**State management** — Three Zustand stores (with Immer middleware):
- `authStore` — current user and access token
- `boardStore` — active board data (columns, swimlanes, cards, labels)
- `notificationStore` — notification count

The `boardStore` is the primary mutable state for the board view; Socket.io events are consumed in feature components/hooks and dispatch store actions.

**Routing** — React Router 7. Routes are in `App.tsx`. Protected routes wrap children in `<AuthGuard>`. URL pattern: `/teams/:teamId/boards/:boardId`.

**API calls** — All HTTP calls are in `apps/web/src/api/`. Vite dev server proxies `/api`, `/uploads`, and `/socket.io` to `localhost:3001`.

**WebSocket events** — Event name constants are in `packages/shared/src/types/ws-events.ts` (`WS_EVENTS`). Always use these constants, never hardcode event strings.

### Adding a New Feature

1. Add types to `packages/shared/src/types/` and Zod schemas to `packages/shared/src/validation/`
2. Export from `packages/shared/src/index.ts`
3. Create `apps/api/src/modules/<feature>/` with `.routes.ts`, `.controller.ts`, `.service.ts`
4. Register routes in `apps/api/src/index.ts`
5. Add API client functions in `apps/web/src/api/`
6. Add React components in `apps/web/src/features/` or `apps/web/src/components/`
