# Layer 0: Skeleton — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up the monorepo foundation with pnpm workspaces, TypeScript tooling, Docker-based PostgreSQL, Express API with health check, Vite React frontend, shared types/validation, JWT auth with email/password, Google + Microsoft OAuth, and Teams CRUD.

**Architecture:** pnpm workspace monorepo with three packages: `apps/api` (Express + Drizzle ORM + Socket.IO + Passport.js), `apps/web` (Vite + React + Zustand), and `packages/shared` (Zod schemas + TypeScript types). PostgreSQL runs via Docker Compose.

**Tech Stack:** pnpm, TypeScript 5.x, Express, Drizzle ORM, PostgreSQL, Vite, React 19, Zustand, Zod, JWT, Passport.js (Google + Microsoft OAuth), Tailwind CSS v4, Pino, Vitest

---

## Task 1: Initialize pnpm Monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `.gitignore`
- Create: `apps/api/package.json`
- Create: `apps/web/package.json`
- Create: `packages/shared/package.json`

**Step 1: Initialize git and root package.json**

```bash
cd /Users/gerrit/Code/trello-clone
git init
```

```json
// package.json
{
  "name": "trello-clone",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "db:generate": "pnpm --filter @trello-clone/api db:generate",
    "db:migrate": "pnpm --filter @trello-clone/api db:migrate",
    "db:seed": "pnpm --filter @trello-clone/api db:seed"
  }
}
```

**Step 2: Create workspace config**

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

```ini
# .npmrc
auto-install-peers=true
shamefully-hoist=false
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
```

**Step 4: Create sub-package package.json files**

```json
// packages/shared/package.json
{
  "name": "@trello-clone/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src/",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.24"
  },
  "devDependencies": {
    "typescript": "^5.7"
  }
}
```

```json
// apps/api/package.json
{
  "name": "@trello-clone/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src/",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:seed": "tsx src/db/seed.ts"
  },
  "dependencies": {
    "@trello-clone/shared": "workspace:*",
    "express": "^5.0",
    "cors": "^2.8",
    "helmet": "^8.0",
    "drizzle-orm": "^0.38",
    "postgres": "^3.4",
    "zod": "^3.24",
    "jsonwebtoken": "^9.0",
    "bcrypt": "^5.1",
    "passport": "^0.7",
    "passport-google-oauth20": "^2.0",
    "passport-microsoft": "^1.0",
    "socket.io": "^4.8",
    "pino": "^9.0",
    "pino-pretty": "^13.0",
    "dotenv": "^16.4",
    "fractional-indexing": "^3.2",
    "cookie-parser": "^1.4"
  },
  "devDependencies": {
    "@types/express": "^5.0",
    "@types/cors": "^2.8",
    "@types/jsonwebtoken": "^9.0",
    "@types/bcrypt": "^5.0",
    "@types/passport": "^1.0",
    "@types/passport-google-oauth20": "^2.0",
    "@types/cookie-parser": "^1.4",
    "drizzle-kit": "^0.30",
    "tsx": "^4.19",
    "typescript": "^5.7",
    "vitest": "^3.0",
    "supertest": "^7.0",
    "@types/supertest": "^6.0"
  }
}
```

```json
// apps/web/package.json
{
  "name": "@trello-clone/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint src/",
    "test": "vitest run"
  },
  "dependencies": {
    "@trello-clone/shared": "workspace:*",
    "react": "^19.0",
    "react-dom": "^19.0",
    "react-router": "^7.0",
    "zustand": "^5.0",
    "immer": "^10.1",
    "axios": "^1.7",
    "socket.io-client": "^4.8",
    "zod": "^3.24",
    "react-hook-form": "^7.54",
    "@hookform/resolvers": "^4.0",
    "sonner": "^1.7",
    "lucide-react": "^0.470"
  },
  "devDependencies": {
    "@types/react": "^19.0",
    "@types/react-dom": "^19.0",
    "@vitejs/plugin-react": "^4.3",
    "tailwindcss": "^4.0",
    "@tailwindcss/vite": "^4.0",
    "typescript": "^5.7",
    "vite": "^6.0",
    "vitest": "^3.0",
    "@testing-library/react": "^16.0"
  }
}
```

**Step 5: Install dependencies**

```bash
pnpm install
```

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: initialize pnpm monorepo with workspace packages"
```

---

## Task 2: TypeScript, ESLint, Prettier Configuration

**Files:**
- Create: `tsconfig.base.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/web/tsconfig.json`
- Create: `packages/shared/tsconfig.json`
- Create: `eslint.config.js`
- Create: `.prettierrc`

**Step 1: Create shared TypeScript base config**

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

**Step 2: Create package-specific tsconfigs**

```json
// packages/shared/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

```json
// apps/api/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

```json
// apps/web/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "./dist",
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

**Step 3: Install and configure ESLint + Prettier at root**

```bash
pnpm add -Dw eslint @eslint/js typescript-eslint prettier eslint-config-prettier globals
```

```js
// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  }
);
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

**Step 4: Verify lint runs**

```bash
pnpm lint
```

Expected: No errors (no source files yet to lint).

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: add TypeScript, ESLint, and Prettier configuration"
```

---

## Task 3: Docker Compose for PostgreSQL

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `apps/api/.env.example`

**Step 1: Create docker-compose.yml**

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:17-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: trello
      POSTGRES_PASSWORD: trello_secret
      POSTGRES_DB: trello_clone
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**Step 2: Create .env files**

```bash
# .env.example (root)
# Copy to .env and fill in values

# Database
DATABASE_URL=postgres://trello:trello_secret@localhost:5432/trello_clone

# JWT
JWT_SECRET=change-me-to-a-random-string
JWT_REFRESH_SECRET=change-me-to-another-random-string

# OAuth - Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# OAuth - Microsoft
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# App
API_PORT=3001
WEB_PORT=5173
API_URL=http://localhost:3001
WEB_URL=http://localhost:5173
```

```bash
# apps/api/.env.example — same content, symlinked or copied
```

**Step 3: Start PostgreSQL and verify**

```bash
docker compose up -d
docker compose ps
```

Expected: postgres container running on port 5432.

**Step 4: Create .env from example**

```bash
cp .env.example .env
```

**Step 5: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "chore: add Docker Compose for PostgreSQL"
```

---

## Task 4: Shared Package — Types and Zod Schemas

**Files:**
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types/user.ts`
- Create: `packages/shared/src/types/team.ts`
- Create: `packages/shared/src/types/board.ts`
- Create: `packages/shared/src/types/card.ts`
- Create: `packages/shared/src/types/comment.ts`
- Create: `packages/shared/src/types/ws-events.ts`
- Create: `packages/shared/src/validation/auth.schema.ts`
- Create: `packages/shared/src/validation/team.schema.ts`
- Create: `packages/shared/src/constants/index.ts`

**Step 1: Create type definitions**

```typescript
// packages/shared/src/types/user.ts
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
}

export type TeamRole = 'owner' | 'admin' | 'member';
```

```typescript
// packages/shared/src/types/team.ts
import type { TeamRole } from './user.js';

export interface Team {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMembership {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  createdAt: string;
}

export interface TeamWithMembers extends Team {
  members: Array<{
    id: string;
    userId: string;
    role: TeamRole;
    displayName: string;
    email: string;
    avatarUrl: string | null;
  }>;
}
```

```typescript
// packages/shared/src/types/board.ts
export interface Board {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
  createdBy: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  position: string;
  wipLimit: number | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Swimlane {
  id: string;
  boardId: string;
  name: string;
  position: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
```

```typescript
// packages/shared/src/types/card.ts
export type CardType = 'story' | 'bug' | 'task';

export interface Card {
  id: string;
  boardId: string;
  columnId: string;
  swimlaneId: string;
  parentCardId: string | null;
  cardType: CardType;
  title: string;
  description: string | null;
  position: string;
  isArchived: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CardSummary {
  id: string;
  columnId: string;
  swimlaneId: string;
  parentCardId: string | null;
  cardType: CardType;
  title: string;
  position: string;
  assignees: Array<{ id: string; displayName: string; avatarUrl: string | null }>;
  commentCount: number;
  subtaskCount: number;
  subtaskDoneCount: number;
}
```

```typescript
// packages/shared/src/types/comment.ts
export interface Comment {
  id: string;
  cardId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}
```

```typescript
// packages/shared/src/types/ws-events.ts
export const WS_EVENTS = {
  BOARD_JOIN: 'board:join',
  BOARD_LEAVE: 'board:leave',
  CARD_CREATED: 'card:created',
  CARD_UPDATED: 'card:updated',
  CARD_MOVED: 'card:moved',
  CARD_ARCHIVED: 'card:archived',
  COLUMN_CREATED: 'column:created',
  COLUMN_UPDATED: 'column:updated',
  COLUMN_MOVED: 'column:moved',
  COLUMN_DELETED: 'column:deleted',
  SWIMLANE_CREATED: 'swimlane:created',
  SWIMLANE_MOVED: 'swimlane:moved',
  SWIMLANE_DELETED: 'swimlane:deleted',
  COMMENT_CREATED: 'comment:created',
  ASSIGNEE_ADDED: 'assignee:added',
  ASSIGNEE_REMOVED: 'assignee:removed',
} as const;
```

**Step 2: Create Zod validation schemas**

```typescript
// packages/shared/src/validation/auth.schema.ts
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1, 'Display name is required').max(100),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

```typescript
// packages/shared/src/validation/team.schema.ts
import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member']).default('member'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
```

```typescript
// packages/shared/src/constants/index.ts
export const CARD_TYPES = ['story', 'bug', 'task'] as const;
export const TEAM_ROLES = ['owner', 'admin', 'member'] as const;
```

**Step 3: Create barrel export**

```typescript
// packages/shared/src/index.ts
export * from './types/user.js';
export * from './types/team.js';
export * from './types/board.js';
export * from './types/card.js';
export * from './types/comment.js';
export * from './types/ws-events.js';
export * from './validation/auth.schema.js';
export * from './validation/team.schema.js';
export * from './constants/index.js';
```

**Step 4: Verify TypeScript compiles**

```bash
cd /Users/gerrit/Code/trello-clone
pnpm --filter @trello-clone/shared exec tsc --noEmit
```

Expected: No errors.

**Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared types, Zod schemas, and constants"
```

---

## Task 5: Express Server with Health Check

**Files:**
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/config/env.ts`
- Create: `apps/api/src/middleware/error.ts`

**Step 1: Create environment config**

```typescript
// apps/api/src/config/env.ts
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  API_PORT: z.coerce.number().default(3001),
  WEB_URL: z.string().url().default('http://localhost:5173'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  MICROSOFT_CLIENT_ID: z.string().default(''),
  MICROSOFT_CLIENT_SECRET: z.string().default(''),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
```

**Step 2: Create error handler middleware**

```typescript
// apps/api/src/middleware/error.ts
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { pino } from 'pino';

const logger = pino({ name: 'error-handler' });

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  logger.error(err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', details: err.errors });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
```

**Step 3: Create Express server**

```typescript
// apps/api/src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pino } from 'pino';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';

const logger = pino({ name: 'api' });
const app = express();

app.use(helmet());
app.use(cors({ origin: env.WEB_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

app.listen(env.API_PORT, () => {
  logger.info(`API server running on port ${env.API_PORT}`);
});

export { app };
```

**Step 4: Create .env for local dev**

```bash
cp .env.example apps/api/.env
```

**Step 5: Start the server and test health check**

```bash
pnpm --filter @trello-clone/api dev &
sleep 2
curl http://localhost:3001/api/v1/health
```

Expected: `{"status":"ok","timestamp":"..."}`

**Step 6: Commit**

```bash
git add apps/api/src/
git commit -m "feat: add Express server with health check endpoint"
```

---

## Task 6: Drizzle ORM Schema and Database Setup

**Files:**
- Create: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/db/relations.ts`
- Create: `apps/api/src/db/index.ts`
- Create: `apps/api/src/db/migrate.ts`
- Create: `apps/api/drizzle.config.ts`

**Step 1: Create Drizzle schema**

```typescript
// apps/api/src/db/schema.ts
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
  unique,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

// Enums
export const cardTypeEnum = pgEnum('card_type', ['story', 'bug', 'task']);
export const teamRoleEnum = pgEnum('team_role', ['owner', 'admin', 'member']);

// Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  googleId: varchar('google_id', { length: 255 }).unique(),
  microsoftId: varchar('microsoft_id', { length: 255 }).unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Teams
export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Team Memberships
export const teamMemberships = pgTable(
  'team_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: teamRoleEnum('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.teamId, t.userId), index('idx_tm_team').on(t.teamId), index('idx_tm_user').on(t.userId)],
);

// Boards
export const boards = pgTable(
  'boards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_boards_team').on(t.teamId)],
);

// Columns
export const columns = pgTable(
  'columns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    position: varchar('position', { length: 50 }).notNull(),
    wipLimit: integer('wip_limit'),
    color: varchar('color', { length: 7 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_columns_board').on(t.boardId), index('idx_columns_board_pos').on(t.boardId, t.position)],
);

// Swimlanes
export const swimlanes = pgTable(
  'swimlanes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    position: varchar('position', { length: 50 }).notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_swimlanes_board').on(t.boardId)],
);

// Cards
export const cards = pgTable(
  'cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
    columnId: uuid('column_id').notNull().references(() => columns.id, { onDelete: 'cascade' }),
    swimlaneId: uuid('swimlane_id').notNull().references(() => swimlanes.id),
    parentCardId: uuid('parent_card_id').references((): AnyPgColumn => cards.id, { onDelete: 'set null' }),
    cardType: cardTypeEnum('card_type').notNull().default('task'),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description'),
    position: varchar('position', { length: 50 }).notNull(),
    isArchived: boolean('is_archived').notNull().default(false),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_cards_col_swim').on(t.columnId, t.swimlaneId, t.position),
    index('idx_cards_parent').on(t.parentCardId),
    index('idx_cards_board').on(t.boardId),
  ],
);

// Card Assignees
export const cardAssignees = pgTable(
  'card_assignees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cardId: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.cardId, t.userId), index('idx_ca_card').on(t.cardId), index('idx_ca_user').on(t.userId)],
);

// Comments
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cardId: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_comments_card').on(t.cardId)],
);

// Refresh Tokens
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('idx_rt_user').on(t.userId)],
);
```

**Step 2: Create Drizzle relations**

```typescript
// apps/api/src/db/relations.ts
import { relations } from 'drizzle-orm';
import {
  users,
  teams,
  teamMemberships,
  boards,
  columns,
  swimlanes,
  cards,
  cardAssignees,
  comments,
  refreshTokens,
} from './schema.js';

export const usersRelations = relations(users, ({ many }) => ({
  teamMemberships: many(teamMemberships),
  createdBoards: many(boards),
  cardAssignees: many(cardAssignees),
  comments: many(comments),
  refreshTokens: many(refreshTokens),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  memberships: many(teamMemberships),
  boards: many(boards),
}));

export const teamMembershipsRelations = relations(teamMemberships, ({ one }) => ({
  team: one(teams, { fields: [teamMemberships.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMemberships.userId], references: [users.id] }),
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
  team: one(teams, { fields: [boards.teamId], references: [teams.id] }),
  creator: one(users, { fields: [boards.createdBy], references: [users.id] }),
  columns: many(columns),
  swimlanes: many(swimlanes),
  cards: many(cards),
}));

export const columnsRelations = relations(columns, ({ one, many }) => ({
  board: one(boards, { fields: [columns.boardId], references: [boards.id] }),
  cards: many(cards),
}));

export const swimlanesRelations = relations(swimlanes, ({ one, many }) => ({
  board: one(boards, { fields: [swimlanes.boardId], references: [boards.id] }),
  cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  board: one(boards, { fields: [cards.boardId], references: [boards.id] }),
  column: one(columns, { fields: [cards.columnId], references: [columns.id] }),
  swimlane: one(swimlanes, { fields: [cards.swimlaneId], references: [swimlanes.id] }),
  parentCard: one(cards, { fields: [cards.parentCardId], references: [cards.id], relationName: 'subtasks' }),
  subtasks: many(cards, { relationName: 'subtasks' }),
  creator: one(users, { fields: [cards.createdBy], references: [users.id] }),
  assignees: many(cardAssignees),
  comments: many(comments),
}));

export const cardAssigneesRelations = relations(cardAssignees, ({ one }) => ({
  card: one(cards, { fields: [cardAssignees.cardId], references: [cards.id] }),
  user: one(users, { fields: [cardAssignees.userId], references: [users.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  card: one(cards, { fields: [comments.cardId], references: [cards.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));
```

**Step 3: Create DB instance**

```typescript
// apps/api/src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env.js';
import * as schema from './schema.js';
import * as relations from './relations.js';

const client = postgres(env.DATABASE_URL);
export const db = drizzle(client, { schema: { ...schema, ...relations } });

export { schema };
```

**Step 4: Create migration runner**

```typescript
// apps/api/src/db/migrate.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '../config/env.js';

const client = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(client);

async function main() {
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  console.log('Migrations complete.');
  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

**Step 5: Create Drizzle Kit config**

```typescript
// apps/api/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 6: Generate and run migrations**

```bash
cd /Users/gerrit/Code/trello-clone
pnpm --filter @trello-clone/api db:generate
pnpm --filter @trello-clone/api db:migrate
```

Expected: Migration files generated in `apps/api/src/db/migrations/`, tables created in PostgreSQL.

**Step 7: Commit**

```bash
git add apps/api/src/db/ apps/api/drizzle.config.ts
git commit -m "feat: add Drizzle ORM schema with all tables and migrations"
```

---

## Task 7: Validation Middleware

**Files:**
- Create: `apps/api/src/middleware/validate.ts`

**Step 1: Create Zod validation middleware**

```typescript
// apps/api/src/middleware/validate.ts
import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}
```

**Step 2: Commit**

```bash
git add apps/api/src/middleware/validate.ts
git commit -m "feat: add Zod validation middleware"
```

---

## Task 8: Auth — JWT + Email/Password Registration and Login

**Files:**
- Create: `apps/api/src/modules/auth/auth.routes.ts`
- Create: `apps/api/src/modules/auth/auth.controller.ts`
- Create: `apps/api/src/modules/auth/auth.service.ts`
- Create: `apps/api/src/middleware/auth.ts`
- Modify: `apps/api/src/index.ts` — mount auth routes

**Step 1: Create auth service**

```typescript
// apps/api/src/modules/auth/auth.service.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/error.js';
import type { RegisterInput, LoginInput } from '@trello-clone/shared';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function generateAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

async function generateRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(40).toString('hex');
  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(schema.refreshTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return token;
}

export async function register(input: RegisterInput) {
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, input.email),
  });

  if (existing) {
    throw new AppError(409, 'Email already registered');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const [user] = await db
    .insert(schema.users)
    .values({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
    })
    .returning({
      id: schema.users.id,
      email: schema.users.email,
      displayName: schema.users.displayName,
      avatarUrl: schema.users.avatarUrl,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
    });

  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(user.id);

  return { user, accessToken, refreshToken };
}

export async function login(input: LoginInput) {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, input.email),
  });

  if (!user || !user.passwordHash) {
    throw new AppError(401, 'Invalid email or password');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'Invalid email or password');
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    accessToken,
    refreshToken,
  };
}

export async function refreshAccessToken(token: string) {
  const allTokens = await db.query.refreshTokens.findMany({
    where: and(isNull(schema.refreshTokens.revokedAt)),
  });

  let matchedToken = null;
  for (const t of allTokens) {
    const valid = await bcrypt.compare(token, t.tokenHash);
    if (valid) {
      matchedToken = t;
      break;
    }
  }

  if (!matchedToken || matchedToken.expiresAt < new Date()) {
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  // Revoke old token
  await db
    .update(schema.refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(schema.refreshTokens.id, matchedToken.id));

  // Issue new tokens
  const accessToken = generateAccessToken(matchedToken.userId);
  const refreshToken = await generateRefreshToken(matchedToken.userId);

  return { accessToken, refreshToken };
}

export async function revokeRefreshToken(token: string) {
  const allTokens = await db.query.refreshTokens.findMany({
    where: and(isNull(schema.refreshTokens.revokedAt)),
  });

  for (const t of allTokens) {
    const valid = await bcrypt.compare(token, t.tokenHash);
    if (valid) {
      await db
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(schema.refreshTokens.id, t.id));
      return;
    }
  }
}

export async function getMe(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  return user;
}

export async function findOrCreateOAuthUser(
  provider: 'google' | 'microsoft',
  profile: { id: string; email: string; displayName: string; avatarUrl?: string },
) {
  const providerIdField = provider === 'google' ? schema.users.googleId : schema.users.microsoftId;

  // Check if user already linked by provider ID
  let user = await db.query.users.findFirst({
    where: eq(providerIdField, profile.id),
  });

  if (user) {
    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);
    return { user, accessToken, refreshToken };
  }

  // Check if user exists with same email (account linking)
  user = await db.query.users.findFirst({
    where: eq(schema.users.email, profile.email),
  });

  if (user) {
    // Link existing account with OAuth provider
    await db
      .update(schema.users)
      .set({ [provider === 'google' ? 'googleId' : 'microsoftId']: profile.id })
      .where(eq(schema.users.id, user.id));

    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);
    return { user, accessToken, refreshToken };
  }

  // Create new user
  const [newUser] = await db
    .insert(schema.users)
    .values({
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl ?? null,
      [provider === 'google' ? 'googleId' : 'microsoftId']: profile.id,
    })
    .returning();

  const accessToken = generateAccessToken(newUser.id);
  const refreshToken = await generateRefreshToken(newUser.id);
  return { user: newUser, accessToken, refreshToken };
}
```

**Step 2: Create auth middleware (JWT verification)**

```typescript
// apps/api/src/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './error.js';

export interface AuthRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, 'Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }
}
```

**Step 3: Create auth controller**

```typescript
// apps/api/src/modules/auth/auth.controller.ts
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as authService from './auth.service.js';

const REFRESH_TOKEN_COOKIE = 'refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth',
};

export async function registerHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { user, accessToken, refreshToken } = await authService.register(req.body);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);
    res.status(201).json({ user, accessToken });
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { user, accessToken, refreshToken } = await authService.login(req.body);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);
    res.json({ user, accessToken });
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies[REFRESH_TOKEN_COOKIE];
    if (!token) {
      res.status(401).json({ error: 'No refresh token provided' });
      return;
    }

    const { accessToken, refreshToken } = await authService.refreshAccessToken(token);
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies[REFRESH_TOKEN_COOKIE];
    if (token) {
      await authService.revokeRefreshToken(token);
    }
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' });
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

export async function meHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await authService.getMe(req.userId!);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
```

**Step 4: Create auth routes**

```typescript
// apps/api/src/modules/auth/auth.routes.ts
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { registerSchema, loginSchema } from '@trello-clone/shared';
import * as ctrl from './auth.controller.js';

const router = Router();

router.post('/register', validate(registerSchema), ctrl.registerHandler);
router.post('/login', validate(loginSchema), ctrl.loginHandler);
router.post('/refresh', ctrl.refreshHandler);
router.post('/logout', ctrl.logoutHandler);
router.get('/me', requireAuth, ctrl.meHandler);

export { router as authRoutes };
```

**Step 5: Mount auth routes in Express app**

Update `apps/api/src/index.ts` — add before `app.use(errorHandler)`:

```typescript
import { authRoutes } from './modules/auth/auth.routes.js';
// ... after other middleware
app.use('/api/v1/auth', authRoutes);
```

**Step 6: Test auth endpoints manually**

```bash
# Register
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword123","displayName":"Test User"}'

# Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword123"}'

# Me (use accessToken from login response)
curl http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

**Step 7: Commit**

```bash
git add apps/api/src/modules/auth/ apps/api/src/middleware/auth.ts apps/api/src/index.ts
git commit -m "feat: add JWT auth with register, login, refresh, and logout"
```

---

## Task 9: OAuth — Google + Microsoft Login via Passport.js

**Files:**
- Create: `apps/api/src/modules/auth/passport.ts`
- Modify: `apps/api/src/modules/auth/auth.routes.ts` — add OAuth routes
- Modify: `apps/api/src/index.ts` — initialize Passport

**Step 1: Create Passport strategies**

```typescript
// apps/api/src/modules/auth/passport.ts
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from '../../config/env.js';
import { findOrCreateOAuthUser } from './auth.service.js';

export function setupPassport() {
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${env.API_URL || `http://localhost:${env.API_PORT}`}/api/v1/auth/google/callback`,
          scope: ['profile', 'email'],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error('No email found in Google profile'));
            }

            const result = await findOrCreateOAuthUser('google', {
              id: profile.id,
              email,
              displayName: profile.displayName,
              avatarUrl: profile.photos?.[0]?.value,
            });

            done(null, result);
          } catch (err) {
            done(err as Error);
          }
        },
      ),
    );
  }

  // Microsoft strategy uses similar passport-microsoft package
  // Add when MICROSOFT_CLIENT_ID is configured
  // Follows same pattern as Google
}
```

**Step 2: Add OAuth routes**

Add to `apps/api/src/modules/auth/auth.routes.ts`:

```typescript
import passport from 'passport';
import { env } from '../../config/env.js';
import type { Response } from 'express';

// Google OAuth
router.get('/google', passport.authenticate('google', { session: false, scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${env.WEB_URL}/login?error=google_auth_failed` }),
  (req, res: Response) => {
    const { accessToken, refreshToken } = req.user as { accessToken: string; refreshToken: string };
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);
    res.redirect(`${env.WEB_URL}/auth/callback?token=${accessToken}`);
  },
);
```

Note: Import `REFRESH_TOKEN_COOKIE` and `COOKIE_OPTIONS` from the controller or define them as shared constants within the auth module.

**Step 3: Initialize Passport in index.ts**

Add to `apps/api/src/index.ts`:

```typescript
import passport from 'passport';
import { setupPassport } from './modules/auth/passport.js';

setupPassport();
app.use(passport.initialize());
```

**Step 4: Commit**

```bash
git add apps/api/src/modules/auth/passport.ts apps/api/src/modules/auth/auth.routes.ts apps/api/src/index.ts
git commit -m "feat: add Google OAuth login via Passport.js"
```

---

## Task 10: Teams CRUD + Memberships

**Files:**
- Create: `apps/api/src/modules/teams/teams.routes.ts`
- Create: `apps/api/src/modules/teams/teams.controller.ts`
- Create: `apps/api/src/modules/teams/teams.service.ts`
- Create: `apps/api/src/utils/slug.ts`
- Modify: `apps/api/src/index.ts` — mount teams routes

**Step 1: Create slug utility**

```typescript
// apps/api/src/utils/slug.ts
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

**Step 2: Create teams service**

```typescript
// apps/api/src/modules/teams/teams.service.ts
import { eq, and } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { AppError } from '../../middleware/error.js';
import { slugify } from '../../utils/slug.js';
import type { CreateTeamInput, UpdateTeamInput, InviteMemberInput, UpdateMemberRoleInput } from '@trello-clone/shared';

export async function createTeam(userId: string, input: CreateTeamInput) {
  const slug = slugify(input.name) + '-' + Date.now().toString(36);

  const [team] = await db.insert(schema.teams).values({ name: input.name, slug }).returning();

  await db.insert(schema.teamMemberships).values({
    teamId: team.id,
    userId,
    role: 'owner',
  });

  return team;
}

export async function getUserTeams(userId: string) {
  const memberships = await db.query.teamMemberships.findMany({
    where: eq(schema.teamMemberships.userId, userId),
    with: { team: true },
  });

  return memberships.map((m) => ({ ...m.team, role: m.role }));
}

export async function getTeam(teamId: string, userId: string) {
  const membership = await db.query.teamMemberships.findFirst({
    where: and(eq(schema.teamMemberships.teamId, teamId), eq(schema.teamMemberships.userId, userId)),
  });

  if (!membership) {
    throw new AppError(403, 'Not a member of this team');
  }

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
  });

  if (!team) {
    throw new AppError(404, 'Team not found');
  }

  const members = await db.query.teamMemberships.findMany({
    where: eq(schema.teamMemberships.teamId, teamId),
    with: {
      user: { columns: { id: true, email: true, displayName: true, avatarUrl: true } },
    },
  });

  return {
    ...team,
    members: members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      role: m.role,
      displayName: m.user.displayName,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
    })),
  };
}

export async function updateTeam(teamId: string, userId: string, input: UpdateTeamInput) {
  await requireRole(teamId, userId, ['owner', 'admin']);

  const [team] = await db
    .update(schema.teams)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.teams.id, teamId))
    .returning();

  return team;
}

export async function deleteTeam(teamId: string, userId: string) {
  await requireRole(teamId, userId, ['owner']);
  await db.delete(schema.teams).where(eq(schema.teams.id, teamId));
}

export async function inviteMember(teamId: string, userId: string, input: InviteMemberInput) {
  await requireRole(teamId, userId, ['owner', 'admin']);

  const invitee = await db.query.users.findFirst({
    where: eq(schema.users.email, input.email),
  });

  if (!invitee) {
    throw new AppError(404, 'User not found with this email');
  }

  const existing = await db.query.teamMemberships.findFirst({
    where: and(eq(schema.teamMemberships.teamId, teamId), eq(schema.teamMemberships.userId, invitee.id)),
  });

  if (existing) {
    throw new AppError(409, 'User is already a team member');
  }

  const [membership] = await db
    .insert(schema.teamMemberships)
    .values({ teamId, userId: invitee.id, role: input.role })
    .returning();

  return membership;
}

export async function removeMember(teamId: string, userId: string, targetUserId: string) {
  await requireRole(teamId, userId, ['owner', 'admin']);

  if (userId === targetUserId) {
    throw new AppError(400, 'Cannot remove yourself');
  }

  await db
    .delete(schema.teamMemberships)
    .where(and(eq(schema.teamMemberships.teamId, teamId), eq(schema.teamMemberships.userId, targetUserId)));
}

export async function updateMemberRole(teamId: string, userId: string, targetUserId: string, input: UpdateMemberRoleInput) {
  await requireRole(teamId, userId, ['owner']);

  const [membership] = await db
    .update(schema.teamMemberships)
    .set({ role: input.role })
    .where(and(eq(schema.teamMemberships.teamId, teamId), eq(schema.teamMemberships.userId, targetUserId)))
    .returning();

  return membership;
}

async function requireRole(teamId: string, userId: string, roles: string[]) {
  const membership = await db.query.teamMemberships.findFirst({
    where: and(eq(schema.teamMemberships.teamId, teamId), eq(schema.teamMemberships.userId, userId)),
  });

  if (!membership || !roles.includes(membership.role)) {
    throw new AppError(403, 'Insufficient permissions');
  }
}
```

**Step 3: Create teams controller**

```typescript
// apps/api/src/modules/teams/teams.controller.ts
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as teamsService from './teams.service.js';

export async function createHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const team = await teamsService.createTeam(req.userId!, req.body);
    res.status(201).json({ team });
  } catch (err) {
    next(err);
  }
}

export async function listHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const teams = await teamsService.getUserTeams(req.userId!);
    res.json({ teams });
  } catch (err) {
    next(err);
  }
}

export async function getHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const team = await teamsService.getTeam(req.params.teamId, req.userId!);
    res.json({ team });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const team = await teamsService.updateTeam(req.params.teamId, req.userId!, req.body);
    res.json({ team });
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await teamsService.deleteTeam(req.params.teamId, req.userId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function inviteMemberHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const membership = await teamsService.inviteMember(req.params.teamId, req.userId!, req.body);
    res.status(201).json({ membership });
  } catch (err) {
    next(err);
  }
}

export async function removeMemberHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await teamsService.removeMember(req.params.teamId, req.userId!, req.params.userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function updateMemberRoleHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const membership = await teamsService.updateMemberRole(
      req.params.teamId,
      req.userId!,
      req.params.userId,
      req.body,
    );
    res.json({ membership });
  } catch (err) {
    next(err);
  }
}
```

**Step 4: Create teams routes**

```typescript
// apps/api/src/modules/teams/teams.routes.ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createTeamSchema, updateTeamSchema, inviteMemberSchema, updateMemberRoleSchema } from '@trello-clone/shared';
import * as ctrl from './teams.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/', validate(createTeamSchema), ctrl.createHandler);
router.get('/', ctrl.listHandler);
router.get('/:teamId', ctrl.getHandler);
router.patch('/:teamId', validate(updateTeamSchema), ctrl.updateHandler);
router.delete('/:teamId', ctrl.deleteHandler);

router.post('/:teamId/members', validate(inviteMemberSchema), ctrl.inviteMemberHandler);
router.delete('/:teamId/members/:userId', ctrl.removeMemberHandler);
router.patch('/:teamId/members/:userId', validate(updateMemberRoleSchema), ctrl.updateMemberRoleHandler);

export { router as teamRoutes };
```

**Step 5: Mount teams routes in index.ts**

Add to `apps/api/src/index.ts`:

```typescript
import { teamRoutes } from './modules/teams/teams.routes.js';
app.use('/api/v1/teams', teamRoutes);
```

**Step 6: Test teams endpoints**

```bash
# Create team (use access token from auth)
curl -X POST http://localhost:3001/api/v1/teams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"name":"My Team"}'

# List teams
curl http://localhost:3001/api/v1/teams \
  -H "Authorization: Bearer <TOKEN>"
```

**Step 7: Commit**

```bash
git add apps/api/src/modules/teams/ apps/api/src/utils/slug.ts apps/api/src/index.ts
git commit -m "feat: add Teams CRUD with memberships and role-based access"
```

---

## Task 11: Vite + React Frontend Scaffold

**Files:**
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/main.css`
- Create: `apps/web/src/vite-env.d.ts`

**Step 1: Create Vite config**

```typescript
// apps/web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

**Step 2: Create HTML entry**

```html
<!-- apps/web/index.html -->
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Trello Clone</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 3: Create React entry and App**

```css
/* apps/web/src/main.css */
@import "tailwindcss";
```

```typescript
// apps/web/src/vite-env.d.ts
/// <reference types="vite/client" />
```

```tsx
// apps/web/src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './main.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

```tsx
// apps/web/src/App.tsx
export function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">Trello Clone</h1>
        <p className="mt-2 text-gray-600">Kanban Board — Coming Soon</p>
      </div>
    </div>
  );
}
```

**Step 4: Start frontend dev server**

```bash
pnpm --filter @trello-clone/web dev
```

Expected: Vite dev server on http://localhost:5173, showing "Trello Clone" heading with Tailwind styling.

**Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat: scaffold Vite + React + Tailwind frontend"
```

---

## Task 12: Frontend Auth — Zustand Store, API Client, Login/Register Pages

**Files:**
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/api/auth.api.ts`
- Create: `apps/web/src/stores/authStore.ts`
- Create: `apps/web/src/features/auth/LoginPage.tsx`
- Create: `apps/web/src/features/auth/RegisterPage.tsx`
- Create: `apps/web/src/features/auth/AuthCallbackPage.tsx`
- Create: `apps/web/src/components/ui/Button.tsx`
- Create: `apps/web/src/components/ui/Input.tsx`
- Create: `apps/web/src/components/layout/AuthLayout.tsx`
- Modify: `apps/web/src/App.tsx` — add routing

**Step 1: Create Axios client with refresh interceptor**

```typescript
// apps/web/src/api/client.ts
import axios from 'axios';
import { useAuthStore } from '../stores/authStore.js';

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        const newToken = data.accessToken;
        useAuthStore.getState().setAccessToken(newToken);

        failedQueue.forEach(({ resolve }) => resolve(newToken));
        failedQueue = [];

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        failedQueue.forEach(({ reject }) => reject(refreshError));
        failedQueue = [];
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
```

**Step 2: Create auth API functions**

```typescript
// apps/web/src/api/auth.api.ts
import { api } from './client.js';
import type { User, LoginResponse, RegisterInput, LoginInput } from '@trello-clone/shared';

export async function registerUser(input: RegisterInput): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/register', input);
  return data;
}

export async function loginUser(input: LoginInput): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', input);
  return data;
}

export async function getMe(): Promise<{ user: User }> {
  const { data } = await api.get<{ user: User }>('/auth/me');
  return data;
}

export async function logoutUser(): Promise<void> {
  await api.post('/auth/logout');
}
```

**Step 3: Create auth Zustand store**

```typescript
// apps/web/src/stores/authStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { User } from '@trello-clone/shared';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      accessToken: null,
      isLoading: true,
      setAuth: (user, accessToken) => set({ user, accessToken, isLoading: false }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, accessToken: null, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    { name: 'AuthStore' },
  ),
);
```

**Step 4: Create UI components**

```tsx
// apps/web/src/components/ui/Button.tsx
import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-blue-500',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-blue-500',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
```

```tsx
// apps/web/src/components/ui/Input.tsx
import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, className = '', ...props }, ref) => {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <input
        ref={ref}
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
});
```

**Step 5: Create Auth layout and pages**

```tsx
// apps/web/src/components/layout/AuthLayout.tsx
import type { ReactNode } from 'react';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">Trello Clone</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">{children}</div>
      </div>
    </div>
  );
}
```

```tsx
// apps/web/src/features/auth/LoginPage.tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@trello-clone/shared';
import { loginUser } from '../../api/auth.api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { AuthLayout } from '../../components/layout/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    try {
      setError('');
      const { user, accessToken } = await loginUser(data);
      setAuth(user, accessToken);
      navigate('/teams');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <AuthLayout>
      <h2 className="text-xl font-semibold mb-6">Anmelden</h2>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="E-Mail" type="email" {...register('email')} error={errors.email?.message} />
        <Input label="Passwort" type="password" {...register('password')} error={errors.password?.message} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Anmelden...' : 'Anmelden'}
        </Button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-gray-500">oder</span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <a
            href="/api/v1/auth/google"
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Login mit Google
          </a>
          <a
            href="/api/v1/auth/microsoft"
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Login mit Microsoft
          </a>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-gray-600">
        Noch kein Konto?{' '}
        <Link to="/register" className="text-blue-600 hover:underline">
          Registrieren
        </Link>
      </p>
    </AuthLayout>
  );
}
```

```tsx
// apps/web/src/features/auth/RegisterPage.tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@trello-clone/shared';
import { registerUser } from '../../api/auth.api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { AuthLayout } from '../../components/layout/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterInput) => {
    try {
      setError('');
      const { user, accessToken } = await registerUser(data);
      setAuth(user, accessToken);
      navigate('/teams');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <AuthLayout>
      <h2 className="text-xl font-semibold mb-6">Registrieren</h2>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Name" {...register('displayName')} error={errors.displayName?.message} />
        <Input label="E-Mail" type="email" {...register('email')} error={errors.email?.message} />
        <Input label="Passwort" type="password" {...register('password')} error={errors.password?.message} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Registrieren...' : 'Registrieren'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Bereits ein Konto?{' '}
        <Link to="/login" className="text-blue-600 hover:underline">
          Anmelden
        </Link>
      </p>
    </AuthLayout>
  );
}
```

```tsx
// apps/web/src/features/auth/AuthCallbackPage.tsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuthStore } from '../../stores/authStore.js';
import { getMe } from '../../api/auth.api.js';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      useAuthStore.getState().setAccessToken(token);
      getMe().then(({ user }) => {
        setAuth(user, token);
        navigate('/teams');
      });
    } else {
      navigate('/login');
    }
  }, [searchParams, setAuth, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Authentifizierung...</p>
    </div>
  );
}
```

**Step 6: Update App.tsx with routing**

```tsx
// apps/web/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore.js';
import { getMe } from './api/auth.api.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { RegisterPage } from './features/auth/RegisterPage.js';
import { AuthCallbackPage } from './features/auth/AuthCallbackPage.js';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Laden...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route
        path="/teams"
        element={
          <AuthGuard>
            <div className="p-8">
              <h1 className="text-2xl font-bold">Teams</h1>
              <p className="text-gray-500 mt-2">Team-Übersicht kommt in Layer 1.</p>
            </div>
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/teams" />} />
    </Routes>
  );
}

export function App() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    getMe()
      .then(({ user }) => {
        setAuth(user, useAuthStore.getState().accessToken || '');
      })
      .catch(() => {
        setLoading(false);
      });
  }, [setAuth, setLoading]);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
```

**Step 7: Start both servers and test**

```bash
pnpm dev
```

Expected: API on :3001, Frontend on :5173. Navigate to http://localhost:5173 → redirects to /login. Register a user → redirected to /teams placeholder.

**Step 8: Commit**

```bash
git add apps/web/
git commit -m "feat: add frontend auth with login, register, OAuth buttons, and routing"
```

---

## Summary

After completing all 12 tasks, Layer 0 provides:

1. **Monorepo** — pnpm workspaces with 3 packages
2. **Tooling** — TypeScript, ESLint, Prettier
3. **Database** — PostgreSQL via Docker, Drizzle ORM with complete schema + migrations
4. **API** — Express with health check, error handling, Zod validation
5. **Auth** — JWT (register, login, refresh, logout) + Google OAuth via Passport.js
6. **Teams** — Full CRUD with role-based memberships (owner/admin/member)
7. **Frontend** — Vite + React + Tailwind with auth pages, Zustand store, API client with auto-refresh
8. **Shared** — TypeScript types + Zod schemas used by both FE and BE

Next: **Layer 1 — Core Board** (Board/Column/Card CRUD + Drag & Drop)
