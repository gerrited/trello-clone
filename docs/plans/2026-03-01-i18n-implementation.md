# i18n (DE/EN/IT/FR) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full UI internationalization (DE, EN, IT, FR) using i18next + react-i18next, with language preference saved per-user in the database and also persisted in localStorage for unauthenticated users.

**Architecture:** Single-namespace translation files (`apps/web/src/locales/{lang}/translation.json`) bundled with the app. Backend stores language in the `users.language` column. On login, the user's DB language overrides localStorage. A `LanguageSelector` button-group component is placed in the login/register pages and user menu.

**Tech Stack:** i18next, react-i18next, i18next-browser-languagedetector; Drizzle ORM migration; existing Express/React/Zustand/Zod stack.

---

## Task 1: Add `language` column to DB schema

**Files:**
- Modify: `apps/api/src/db/schema.ts:21-31`

**Step 1: Add `language` field to users table**

Edit `apps/api/src/db/schema.ts`. In the `users` table definition, add after `microsoftId`:

```ts
language: varchar('language', { length: 5 }).notNull().default('en'),
```

The users table block should look like:
```ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  googleId: varchar('google_id', { length: 255 }).unique(),
  microsoftId: varchar('microsoft_id', { length: 255 }).unique(),
  language: varchar('language', { length: 5 }).notNull().default('en'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**Step 2: Generate and apply migration**

```bash
cd /Users/gerrit/Code/trello-clone/.claude/worktrees/great-proskuriakova
pnpm db:generate
pnpm db:migrate
```

Expected: migration files created and applied with no errors.

**Step 3: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/src/db/migrations/
git commit -m "feat: add language column to users table"
```

---

## Task 2: Update shared types and validation schemas

**Files:**
- Modify: `packages/shared/src/types/user.ts`
- Modify: `packages/shared/src/validation/auth.schema.ts`
- Modify: `packages/shared/src/validation/user.schema.ts`

**Step 1: Add `language` to User interface**

Replace the entire content of `packages/shared/src/types/user.ts`:

```ts
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  hasPassword: boolean;
  language: string;
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

**Step 2: Add `language` to updateProfileSchema**

Replace `packages/shared/src/validation/user.schema.ts`:

```ts
import { z } from 'zod';

const SUPPORTED_LANGS = ['en', 'de', 'fr', 'it'] as const;

export const updateProfileSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(100),
  email: z.string().email('Invalid email address'),
  language: z.enum(SUPPORTED_LANGS).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
```

**Step 3: Add `language` to registerSchema**

Replace `packages/shared/src/validation/auth.schema.ts`:

```ts
import { z } from 'zod';

const SUPPORTED_LANGS = ['en', 'de', 'fr', 'it'] as const;

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1, 'Display name is required').max(100),
  language: z.enum(SUPPORTED_LANGS).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

**Step 4: Build shared to verify no TypeScript errors**

```bash
cd /Users/gerrit/Code/trello-clone/.claude/worktrees/great-proskuriakova
pnpm --filter @trello-clone/shared build
```

Expected: builds cleanly.

**Step 5: Commit**

```bash
git add packages/shared/src/types/user.ts packages/shared/src/validation/auth.schema.ts packages/shared/src/validation/user.schema.ts
git commit -m "feat: add language field to shared types and validation schemas"
```

---

## Task 3: Update auth service to include language in all user responses

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.ts`

The auth service has 4 places that construct user objects: `register()`, `login()`, `getMe()`, and `findOrCreateOAuthUser()` (which has 3 branches). All need to include `language`.

**Step 1: Update `register()` — add language to insert values and returning**

In the `register()` function, update `.values()` to include language and `.returning()` to include language:

```ts
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
      language: input.language ?? 'en',
    })
    .returning({
      id: schema.users.id,
      email: schema.users.email,
      displayName: schema.users.displayName,
      avatarUrl: schema.users.avatarUrl,
      language: schema.users.language,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
    });

  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(user.id);

  return { user: { ...user, hasPassword: true }, accessToken, refreshToken };
}
```

**Step 2: Update `login()` — add language to returned user object**

Find the `login()` function (lines 65–95). The current return maps user fields manually. Update it to include language. Find this block:

```ts
  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      hasPassword: user.passwordHash !== null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    accessToken,
    refreshToken,
  };
}
```

Replace with:

```ts
  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      language: user.language,
      hasPassword: user.passwordHash !== null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    accessToken,
    refreshToken,
  };
}
```

**Step 3: Update `getMe()` — add language to columns query**

Find `getMe()` (lines 145–165). Update the columns object to include language:

```ts
export async function getMe(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      passwordHash: true,
      language: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  const { passwordHash, ...rest } = user;
  return { ...rest, hasPassword: passwordHash !== null };
}
```

**Step 4: Update `findOrCreateOAuthUser()` — add language to all 3 return branches**

There are 3 return branches in `findOrCreateOAuthUser()`. Each constructs a user object manually. Add `language: user.language` (or `language: newUser.language`) to all three.

Branch 1 (existing user found by provider ID, around line 181):
```ts
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        language: user.language,
        hasPassword: user.passwordHash !== null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accessToken,
      refreshToken,
    };
```

Branch 2 (existing user found by email, account linking, around line 211):
```ts
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        language: user.language,
        hasPassword: user.passwordHash !== null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accessToken,
      refreshToken,
    };
```

Branch 3 (new user created, around line 241):
```ts
  return {
    user: {
      id: newUser.id,
      email: newUser.email,
      displayName: newUser.displayName,
      avatarUrl: newUser.avatarUrl,
      language: newUser.language,
      hasPassword: false,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    },
    accessToken,
    refreshToken,
  };
```

**Step 5: Build API to check for TypeScript errors**

```bash
cd /Users/gerrit/Code/trello-clone/.claude/worktrees/great-proskuriakova/apps/api
pnpm build
```

Expected: compiles cleanly.

**Step 6: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts
git commit -m "feat: include language field in all auth service user responses"
```

---

## Task 4: Update users service to handle language field

**Files:**
- Modify: `apps/api/src/modules/users/users.service.ts`

**Step 1: Update `updateProfile()` to persist and return language**

Replace the full content of `apps/api/src/modules/users/users.service.ts`:

```ts
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db/index.js';
import { AppError } from '../../middleware/error.js';
import type { UpdateProfileInput, ChangePasswordInput } from '@trello-clone/shared';

const SALT_ROUNDS = 12;

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, input.email),
  });
  if (existing && existing.id !== userId) {
    throw new AppError(409, 'Email already in use');
  }

  const [updated] = await db
    .update(schema.users)
    .set({
      displayName: input.displayName,
      email: input.email,
      ...(input.language !== undefined ? { language: input.language } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId))
    .returning({
      id: schema.users.id,
      email: schema.users.email,
      displayName: schema.users.displayName,
      avatarUrl: schema.users.avatarUrl,
      passwordHash: schema.users.passwordHash,
      language: schema.users.language,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
    });

  if (!updated) {
    throw new AppError(404, 'User not found');
  }

  const { passwordHash, ...rest } = updated;
  return { ...rest, hasPassword: passwordHash !== null };
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  if (!user || !user.passwordHash) {
    throw new AppError(400, 'Password change not supported for this account');
  }

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) {
    throw new AppError(400, 'Current password is incorrect');
  }

  const newHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  await db
    .update(schema.users)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(schema.users.id, userId));
}
```

**Step 2: Find and update users service test file**

```bash
find /Users/gerrit/Code/trello-clone/.claude/worktrees/great-proskuriakova/apps/api/src/modules/users -name "*.test.ts"
```

If a test file exists, add a test case that verifies `updateProfile` persists the `language` field. If no test file exists, skip to the next step.

**Step 3: Build API**

```bash
cd /Users/gerrit/Code/trello-clone/.claude/worktrees/great-proskuriakova/apps/api
pnpm build
```

Expected: compiles cleanly.

**Step 4: Commit**

```bash
git add apps/api/src/modules/users/users.service.ts
git commit -m "feat: update users service to persist and return language field"
```

---

## Task 5: Install i18next packages in apps/web

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install packages**

```bash
cd /Users/gerrit/Code/trello-clone/.claude/worktrees/great-proskuriakova/apps/web
pnpm add i18next react-i18next i18next-browser-languagedetector
```

Expected: 3 packages added to package.json dependencies.

**Step 2: Verify install**

```bash
cd /Users/gerrit/Code/trello-clone/.claude/worktrees/great-proskuriakova/apps/web
pnpm build
```

Expected: builds cleanly (no new errors from i18next packages).

**Step 3: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml pnpm-lock.yaml
git commit -m "feat: install i18next, react-i18next, i18next-browser-languagedetector"
```

---

## Task 6: Create translation files (all 4 languages)

**Files:**
- Create: `apps/web/src/locales/en/translation.json`
- Create: `apps/web/src/locales/de/translation.json`
- Create: `apps/web/src/locales/fr/translation.json`
- Create: `apps/web/src/locales/it/translation.json`

**Step 1: Create English translation file**

Create `apps/web/src/locales/en/translation.json`:

```json
{
  "common": {
    "save": "Save",
    "saving": "Saving...",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "add": "Add",
    "loading": "Loading...",
    "create": "Create",
    "creating": "Creating...",
    "close": "Close",
    "rename": "Rename",
    "upload": "Upload",
    "download": "Download",
    "copy": "Copy",
    "search": "Search",
    "back": "Back",
    "invite": "Invite",
    "confirm": "Confirm"
  },
  "auth": {
    "signIn": "Sign In",
    "signingIn": "Signing in...",
    "register": "Register",
    "registering": "Registering...",
    "email": "Email",
    "password": "Password",
    "name": "Name",
    "or": "or",
    "loginWithGoogle": "Sign in with Google",
    "loginWithMicrosoft": "Sign in with Microsoft",
    "noAccount": "Don't have an account?",
    "alreadyHaveAccount": "Already have an account?",
    "loginFailed": "Login failed",
    "registrationFailed": "Registration failed"
  },
  "user": {
    "editProfile": "Edit Profile",
    "changePassword": "Change Password",
    "logout": "Sign Out",
    "displayName": "Name",
    "email": "Email",
    "currentPassword": "Current Password",
    "newPassword": "New Password",
    "confirmPassword": "Confirm Password",
    "profileUpdated": "Profile updated",
    "passwordChanged": "Password changed",
    "profileUpdateError": "Error updating profile",
    "passwordChangeError": "Error changing password",
    "wrongPassword": "Current password is incorrect",
    "emailInUse": "This email address is already in use",
    "appearance": "Appearance",
    "language": "Language",
    "userProfile": "User profile"
  },
  "theme": {
    "light": "Light",
    "dark": "Dark",
    "system": "System"
  },
  "language": {
    "de": "Deutsch",
    "en": "English",
    "fr": "Français",
    "it": "Italiano"
  },
  "board": {
    "boards": "Boards",
    "backToTeams": "← Teams",
    "backToBoards": "← Boards",
    "createBoard": "+ Create board",
    "noBoards": "No boards yet.",
    "share": "Share",
    "activity": "Activity",
    "filter": "Filter",
    "allAssignees": "All Assignees",
    "overdue": "Overdue",
    "thisWeek": "This Week",
    "noDate": "No Date",
    "calendar": "Calendar",
    "shortcuts": "Shortcuts (?)",
    "cardsCount": "{{filtered}}/{{total}} Cards",
    "deleteColumn": "Delete Column",
    "columnNotEmpty": "Column cannot be deleted because it still contains cards",
    "confirmDeleteColumn": "Really delete column \"{{name}}\"?",
    "columnDeleted": "Column deleted",
    "columnDeleteError": "Could not delete column"
  },
  "column": {
    "addColumn": "+ Add column",
    "columnName": "Column name..."
  },
  "card": {
    "cardDetails": "Card details",
    "cardType": "Card type",
    "description": "Description",
    "addDescription": "Add description...",
    "noDescription": "No description",
    "labels": "Labels",
    "loadError": "Could not load card",
    "titleSaveError": "Could not save title",
    "descriptionSaveError": "Could not save description",
    "typeChangeError": "Could not change card type",
    "confirmDelete": "Really delete card?",
    "deleted": "Card deleted",
    "deleteError": "Could not delete card",
    "column": "Column: {{name}}",
    "swimlane": "Swimlane: {{name}}",
    "assignees": "Assigned",
    "subtaskOf": "Subtask of:",
    "linkRemoved": "Link removed",
    "linkRemoveError": "Could not remove link",
    "dueDate": "Due date",
    "addDueDate": "Set due date...",
    "dueDateSaveError": "Could not save due date",
    "dueDateRemoveError": "Could not remove due date",
    "overdue": "(Overdue)",
    "soon": "Due soon",
    "comments": "Comments",
    "commentAddError": "Could not add comment",
    "commentUpdateError": "Could not update comment",
    "commentDeleteError": "Could not delete comment",
    "commentPlaceholder": "Write a comment...",
    "submitComment": "Post comment",
    "subtasks": "Subtasks",
    "addSubtask": "+ Add subtask",
    "subtaskPlaceholder": "Add subtask...",
    "subtaskCreateError": "Could not create subtask",
    "selectParent": "Select parent card",
    "searchCards": "Search cards...",
    "noMatchingCards": "No matching cards found",
    "assignAsSubtask": "Assign as subtask...",
    "deleteCard": "Delete Card",
    "tooltipSubtask": "Subtask",
    "tooltipComments": "Comments",
    "tooltipAttachments": "Attachments",
    "tooltipSubtasks": "Subtasks",
    "addCard": "+ Add card",
    "cardTitlePlaceholder": "Enter card title...",
    "move": "Move Card",
    "changeColumn": "Change Column",
    "changeSwimlane": "Change Swimlane",
    "moveError": "Could not move card"
  },
  "swimlane": {
    "addSwimlane": "+ Add swimlane",
    "swimlaneName": "Swimlane name...",
    "deleteError": "Error deleting swimlane"
  },
  "label": {
    "labels": "Labels",
    "updateError": "Could not update label",
    "createError": "Could not create label",
    "confirmDelete": "Really delete label? It will be removed from all cards.",
    "deleteError": "Could not delete label",
    "namePlaceholder": "Label name...",
    "preview": "Preview:",
    "create": "Create",
    "noLabels": "No labels yet",
    "newLabel": "Create new label"
  },
  "search": {
    "searchCards": "Search cards...",
    "withDueDate": "With due date",
    "withoutDate": "Without date",
    "searchPlaceholder": "Search...",
    "minChars": "Enter at least 2 characters to search",
    "noResults": "No results for \"{{query}}\"",
    "navigate": "Navigate",
    "open": "Open",
    "close": "Close"
  },
  "share": {
    "shareBoard": "Share Board",
    "inviteByEmail": "Invite by email",
    "emailPlaceholder": "email@example.com",
    "read": "Read",
    "comment": "Comment",
    "edit": "Edit",
    "createLink": "Create Link",
    "invitedUsers": "Invited Users",
    "sharedLinks": "Shared Links",
    "copyLink": "Copy Link",
    "noShares": "No shares yet. Invite users or create a link."
  },
  "calendar": {
    "today": "Today",
    "moreCards": "+{{count}} more",
    "months": {
      "0": "January",
      "1": "February",
      "2": "March",
      "3": "April",
      "4": "May",
      "5": "June",
      "6": "July",
      "7": "August",
      "8": "September",
      "9": "October",
      "10": "November",
      "11": "December"
    },
    "weekdays": {
      "0": "Mo",
      "1": "Tu",
      "2": "We",
      "3": "Th",
      "4": "Fr",
      "5": "Sa",
      "6": "Su"
    }
  },
  "shortcuts": {
    "title": "Keyboard Shortcuts",
    "description": "Press ? on the board to open this dialog"
  },
  "team": {
    "myTeams": "My Teams",
    "createTeam": "+ Create team",
    "teamName": "Team Name",
    "loading": "Loading...",
    "noTeams": "You are not in any team.",
    "createFirstTeam": "Create first team",
    "confirmDelete": "Really delete this team?",
    "deleteTeam": "Delete Team"
  },
  "activity": {
    "noActivity": "No activity yet",
    "justNow": "just now",
    "minutesAgo": "{{count}}m ago",
    "hoursAgo": "{{count}}h ago",
    "daysAgo": "{{count}}d ago",
    "loadMore": "Load more"
  },
  "attachment": {
    "title": "Attachments ({{count}})",
    "uploading": "Uploading...",
    "upload": "Upload file",
    "uploaded": "File uploaded",
    "uploadError": "Upload failed",
    "deleted": "File deleted",
    "deleteError": "Could not delete file",
    "download": "Download",
    "delete": "Delete"
  },
  "template": {
    "namePlaceholder": "Template name...",
    "saving": "...",
    "saved": "Saved!",
    "template": "Template",
    "saveAsTemplate": "Save as template",
    "createBoard": "Create Board",
    "selectTemplate": "Select a template or create an empty board.",
    "boardName": "Board Name",
    "defaultBoardName": "My Board",
    "emptyBoard": "Empty Board",
    "emptyBoardDesc": "Start with an empty board (To Do, In Progress, Done)",
    "loadingTemplates": "Loading templates...",
    "systemTemplates": "System Templates",
    "teamTemplates": "Team Templates",
    "swimlaneCount_one": "{{count}} Swimlane",
    "swimlaneCount_other": "{{count}} Swimlanes"
  },
  "sharedBoard": {
    "loading": "Loading...",
    "accessDenied": "Access denied",
    "notFound": "Board not found",
    "sharedView": "Shared View — {{permission}}",
    "noRealtime": "No real-time updates"
  }
}
```

**Step 2: Create German translation file**

Create `apps/web/src/locales/de/translation.json`:

```json
{
  "common": {
    "save": "Speichern",
    "saving": "Speichern...",
    "cancel": "Abbrechen",
    "delete": "Löschen",
    "edit": "Bearbeiten",
    "add": "Hinzufügen",
    "loading": "Laden...",
    "create": "Erstellen",
    "creating": "Erstellen...",
    "close": "Schliessen",
    "rename": "Umbenennen",
    "upload": "Hochladen",
    "download": "Herunterladen",
    "copy": "Kopieren",
    "search": "Suche",
    "back": "Zurück",
    "invite": "Einladen",
    "confirm": "Bestätigen"
  },
  "auth": {
    "signIn": "Anmelden",
    "signingIn": "Anmelden...",
    "register": "Registrieren",
    "registering": "Registrieren...",
    "email": "E-Mail",
    "password": "Passwort",
    "name": "Name",
    "or": "oder",
    "loginWithGoogle": "Login mit Google",
    "loginWithMicrosoft": "Login mit Microsoft",
    "noAccount": "Noch kein Konto?",
    "alreadyHaveAccount": "Bereits ein Konto?",
    "loginFailed": "Login fehlgeschlagen",
    "registrationFailed": "Registrierung fehlgeschlagen"
  },
  "user": {
    "editProfile": "Profil bearbeiten",
    "changePassword": "Passwort ändern",
    "logout": "Abmelden",
    "displayName": "Name",
    "email": "E-Mail",
    "currentPassword": "Aktuelles Passwort",
    "newPassword": "Neues Passwort",
    "confirmPassword": "Neues Passwort bestätigen",
    "profileUpdated": "Profil aktualisiert",
    "passwordChanged": "Passwort geändert",
    "profileUpdateError": "Fehler beim Aktualisieren des Profils",
    "passwordChangeError": "Fehler beim Ändern des Passworts",
    "wrongPassword": "Aktuelles Passwort ist falsch",
    "emailInUse": "Diese E-Mail-Adresse wird bereits verwendet",
    "appearance": "Darstellung",
    "language": "Sprache",
    "userProfile": "Benutzerprofil"
  },
  "theme": {
    "light": "Hell",
    "dark": "Dunkel",
    "system": "System"
  },
  "language": {
    "de": "Deutsch",
    "en": "English",
    "fr": "Français",
    "it": "Italiano"
  },
  "board": {
    "boards": "Boards",
    "backToTeams": "← Teams",
    "backToBoards": "← Boards",
    "createBoard": "+ Board erstellen",
    "noBoards": "Noch keine Boards vorhanden.",
    "share": "Teilen",
    "activity": "Aktivität",
    "filter": "Filter",
    "allAssignees": "Alle Zuständigen",
    "overdue": "Überfällig",
    "thisWeek": "Diese Woche",
    "noDate": "Kein Datum",
    "calendar": "Kalender",
    "shortcuts": "Tastaturkürzel (?)",
    "cardsCount": "{{filtered}}/{{total}} Karten",
    "deleteColumn": "Spalte löschen",
    "columnNotEmpty": "Spalte kann nicht gelöscht werden, da sie noch Karten enthält",
    "confirmDeleteColumn": "Spalte \"{{name}}\" wirklich löschen?",
    "columnDeleted": "Spalte gelöscht",
    "columnDeleteError": "Spalte konnte nicht gelöscht werden"
  },
  "column": {
    "addColumn": "+ Spalte hinzufügen",
    "columnName": "Spaltenname..."
  },
  "card": {
    "cardDetails": "Kartendetails",
    "cardType": "Kartentyp",
    "description": "Beschreibung",
    "addDescription": "Beschreibung hinzufügen...",
    "noDescription": "Keine Beschreibung",
    "labels": "Labels",
    "loadError": "Karte konnte nicht geladen werden",
    "titleSaveError": "Titel konnte nicht gespeichert werden",
    "descriptionSaveError": "Beschreibung konnte nicht gespeichert werden",
    "typeChangeError": "Kartentyp konnte nicht geändert werden",
    "confirmDelete": "Karte wirklich löschen?",
    "deleted": "Karte gelöscht",
    "deleteError": "Karte konnte nicht gelöscht werden",
    "column": "Spalte: {{name}}",
    "swimlane": "Swimlane: {{name}}",
    "assignees": "Zugewiesen",
    "subtaskOf": "Unteraufgabe von:",
    "linkRemoved": "Verknüpfung entfernt",
    "linkRemoveError": "Verknüpfung konnte nicht entfernt werden",
    "dueDate": "Fälligkeitsdatum",
    "addDueDate": "Fälligkeitsdatum setzen...",
    "dueDateSaveError": "Fälligkeitsdatum konnte nicht gespeichert werden",
    "dueDateRemoveError": "Fälligkeitsdatum konnte nicht entfernt werden",
    "overdue": "(Überfällig)",
    "soon": "Bald fällig",
    "comments": "Kommentare",
    "commentAddError": "Kommentar konnte nicht hinzugefügt werden",
    "commentUpdateError": "Kommentar konnte nicht aktualisiert werden",
    "commentDeleteError": "Kommentar konnte nicht gelöscht werden",
    "commentPlaceholder": "Kommentar schreiben...",
    "submitComment": "Kommentar senden",
    "subtasks": "Unteraufgaben",
    "addSubtask": "+ Unteraufgabe hinzufügen",
    "subtaskPlaceholder": "Unteraufgabe hinzufügen...",
    "subtaskCreateError": "Unteraufgabe konnte nicht erstellt werden",
    "selectParent": "Elternkarte wählen",
    "searchCards": "Karte suchen...",
    "noMatchingCards": "Keine passenden Karten gefunden",
    "assignAsSubtask": "Als Unteraufgabe zuweisen...",
    "deleteCard": "Karte löschen",
    "tooltipSubtask": "Unteraufgabe",
    "tooltipComments": "Kommentare",
    "tooltipAttachments": "Anhänge",
    "tooltipSubtasks": "Unteraufgaben",
    "addCard": "+ Karte hinzufügen",
    "cardTitlePlaceholder": "Kartentitel eingeben...",
    "move": "Karte verschieben",
    "changeColumn": "Spalte wechseln",
    "changeSwimlane": "Swimlane wechseln",
    "moveError": "Karte konnte nicht verschoben werden"
  },
  "swimlane": {
    "addSwimlane": "+ Swimlane hinzufügen",
    "swimlaneName": "Swimlane-Name...",
    "deleteError": "Fehler beim Löschen der Swimlane"
  },
  "label": {
    "labels": "Labels",
    "updateError": "Label konnte nicht aktualisiert werden",
    "createError": "Label konnte nicht erstellt werden",
    "confirmDelete": "Label wirklich löschen? Es wird von allen Karten entfernt.",
    "deleteError": "Label konnte nicht gelöscht werden",
    "namePlaceholder": "Label-Name...",
    "preview": "Vorschau:",
    "create": "Erstellen",
    "noLabels": "Noch keine Labels vorhanden",
    "newLabel": "Neues Label erstellen"
  },
  "search": {
    "searchCards": "Karten suchen...",
    "withDueDate": "Mit Fälligkeitsdatum",
    "withoutDate": "Ohne Datum",
    "searchPlaceholder": "Suche...",
    "minChars": "Mindestens 2 Zeichen eingeben, um zu suchen",
    "noResults": "Keine Ergebnisse für \"{{query}}\"",
    "navigate": "Navigieren",
    "open": "Öffnen",
    "close": "Schliessen"
  },
  "share": {
    "shareBoard": "Board teilen",
    "inviteByEmail": "Per Email einladen",
    "emailPlaceholder": "email@example.com",
    "read": "Lesen",
    "comment": "Kommentieren",
    "edit": "Bearbeiten",
    "createLink": "Link erstellen",
    "invitedUsers": "Eingeladene Benutzer",
    "sharedLinks": "Geteilte Links",
    "copyLink": "Link kopieren",
    "noShares": "Noch keine Freigaben. Laden Sie Benutzer ein oder erstellen Sie einen Link."
  },
  "calendar": {
    "today": "Heute",
    "moreCards": "+{{count}} weitere",
    "months": {
      "0": "Januar",
      "1": "Februar",
      "2": "März",
      "3": "April",
      "4": "Mai",
      "5": "Juni",
      "6": "Juli",
      "7": "August",
      "8": "September",
      "9": "Oktober",
      "10": "November",
      "11": "Dezember"
    },
    "weekdays": {
      "0": "Mo",
      "1": "Di",
      "2": "Mi",
      "3": "Do",
      "4": "Fr",
      "5": "Sa",
      "6": "So"
    }
  },
  "shortcuts": {
    "title": "Tastaturkürzel",
    "description": "Drücke ? auf dem Board um diesen Dialog zu öffnen"
  },
  "team": {
    "myTeams": "Meine Teams",
    "createTeam": "+ Team erstellen",
    "teamName": "Team Name",
    "loading": "Laden...",
    "noTeams": "Du bist noch in keinem Team.",
    "createFirstTeam": "Erstes Team erstellen",
    "confirmDelete": "Möchtest du dieses Team wirklich löschen?",
    "deleteTeam": "Team löschen"
  },
  "activity": {
    "noActivity": "Noch keine Aktivität",
    "justNow": "gerade eben",
    "minutesAgo": "vor {{count}}m",
    "hoursAgo": "vor {{count}}h",
    "daysAgo": "vor {{count}}d",
    "loadMore": "Mehr laden"
  },
  "attachment": {
    "title": "Anhänge ({{count}})",
    "uploading": "Hochladen...",
    "upload": "Datei hochladen",
    "uploaded": "Datei hochgeladen",
    "uploadError": "Upload fehlgeschlagen",
    "deleted": "Datei gelöscht",
    "deleteError": "Datei konnte nicht gelöscht werden",
    "download": "Herunterladen",
    "delete": "Löschen"
  },
  "template": {
    "namePlaceholder": "Vorlagenname...",
    "saving": "...",
    "saved": "Gespeichert!",
    "template": "Vorlage",
    "saveAsTemplate": "Als Vorlage speichern",
    "createBoard": "Board erstellen",
    "selectTemplate": "Wähle eine Vorlage oder erstelle ein leeres Board.",
    "boardName": "Board-Name",
    "defaultBoardName": "Mein Board",
    "emptyBoard": "Leeres Board",
    "emptyBoardDesc": "Beginne mit einem leeren Board (To Do, In Progress, Done)",
    "loadingTemplates": "Vorlagen laden...",
    "systemTemplates": "System-Vorlagen",
    "teamTemplates": "Team-Vorlagen",
    "swimlaneCount_one": "{{count}} Swimlane",
    "swimlaneCount_other": "{{count}} Swimlanes"
  },
  "sharedBoard": {
    "loading": "Laden...",
    "accessDenied": "Zugriff nicht möglich",
    "notFound": "Board nicht gefunden",
    "sharedView": "Geteilte Ansicht — {{permission}}",
    "noRealtime": "Kein Echtzeit-Update"
  }
}
```

**Step 3: Create French translation file**

Create `apps/web/src/locales/fr/translation.json`:

```json
{
  "common": {
    "save": "Enregistrer",
    "saving": "Enregistrement...",
    "cancel": "Annuler",
    "delete": "Supprimer",
    "edit": "Modifier",
    "add": "Ajouter",
    "loading": "Chargement...",
    "create": "Créer",
    "creating": "Création...",
    "close": "Fermer",
    "rename": "Renommer",
    "upload": "Téléverser",
    "download": "Télécharger",
    "copy": "Copier",
    "search": "Rechercher",
    "back": "Retour",
    "invite": "Inviter",
    "confirm": "Confirmer"
  },
  "auth": {
    "signIn": "Se connecter",
    "signingIn": "Connexion...",
    "register": "S'inscrire",
    "registering": "Inscription...",
    "email": "E-mail",
    "password": "Mot de passe",
    "name": "Nom",
    "or": "ou",
    "loginWithGoogle": "Se connecter avec Google",
    "loginWithMicrosoft": "Se connecter avec Microsoft",
    "noAccount": "Pas encore de compte ?",
    "alreadyHaveAccount": "Vous avez déjà un compte ?",
    "loginFailed": "Échec de la connexion",
    "registrationFailed": "Échec de l'inscription"
  },
  "user": {
    "editProfile": "Modifier le profil",
    "changePassword": "Changer le mot de passe",
    "logout": "Se déconnecter",
    "displayName": "Nom",
    "email": "E-mail",
    "currentPassword": "Mot de passe actuel",
    "newPassword": "Nouveau mot de passe",
    "confirmPassword": "Confirmer le mot de passe",
    "profileUpdated": "Profil mis à jour",
    "passwordChanged": "Mot de passe modifié",
    "profileUpdateError": "Erreur lors de la mise à jour du profil",
    "passwordChangeError": "Erreur lors du changement de mot de passe",
    "wrongPassword": "Le mot de passe actuel est incorrect",
    "emailInUse": "Cette adresse e-mail est déjà utilisée",
    "appearance": "Apparence",
    "language": "Langue",
    "userProfile": "Profil utilisateur"
  },
  "theme": {
    "light": "Clair",
    "dark": "Sombre",
    "system": "Système"
  },
  "language": {
    "de": "Deutsch",
    "en": "English",
    "fr": "Français",
    "it": "Italiano"
  },
  "board": {
    "boards": "Tableaux",
    "backToTeams": "← Équipes",
    "backToBoards": "← Tableaux",
    "createBoard": "+ Créer un tableau",
    "noBoards": "Aucun tableau pour l'instant.",
    "share": "Partager",
    "activity": "Activité",
    "filter": "Filtrer",
    "allAssignees": "Tous les responsables",
    "overdue": "En retard",
    "thisWeek": "Cette semaine",
    "noDate": "Sans date",
    "calendar": "Calendrier",
    "shortcuts": "Raccourcis (?)",
    "cardsCount": "{{filtered}}/{{total}} Cartes",
    "deleteColumn": "Supprimer la colonne",
    "columnNotEmpty": "La colonne ne peut pas être supprimée car elle contient encore des cartes",
    "confirmDeleteColumn": "Vraiment supprimer la colonne \"{{name}}\" ?",
    "columnDeleted": "Colonne supprimée",
    "columnDeleteError": "Impossible de supprimer la colonne"
  },
  "column": {
    "addColumn": "+ Ajouter une colonne",
    "columnName": "Nom de la colonne..."
  },
  "card": {
    "cardDetails": "Détails de la carte",
    "cardType": "Type de carte",
    "description": "Description",
    "addDescription": "Ajouter une description...",
    "noDescription": "Aucune description",
    "labels": "Étiquettes",
    "loadError": "Impossible de charger la carte",
    "titleSaveError": "Impossible d'enregistrer le titre",
    "descriptionSaveError": "Impossible d'enregistrer la description",
    "typeChangeError": "Impossible de changer le type de carte",
    "confirmDelete": "Vraiment supprimer la carte ?",
    "deleted": "Carte supprimée",
    "deleteError": "Impossible de supprimer la carte",
    "column": "Colonne : {{name}}",
    "swimlane": "Couloir : {{name}}",
    "assignees": "Assigné",
    "subtaskOf": "Sous-tâche de :",
    "linkRemoved": "Lien supprimé",
    "linkRemoveError": "Impossible de supprimer le lien",
    "dueDate": "Date d'échéance",
    "addDueDate": "Définir une date d'échéance...",
    "dueDateSaveError": "Impossible d'enregistrer la date d'échéance",
    "dueDateRemoveError": "Impossible de supprimer la date d'échéance",
    "overdue": "(En retard)",
    "soon": "Bientôt dû",
    "comments": "Commentaires",
    "commentAddError": "Impossible d'ajouter le commentaire",
    "commentUpdateError": "Impossible de mettre à jour le commentaire",
    "commentDeleteError": "Impossible de supprimer le commentaire",
    "commentPlaceholder": "Écrire un commentaire...",
    "submitComment": "Envoyer",
    "subtasks": "Sous-tâches",
    "addSubtask": "+ Ajouter une sous-tâche",
    "subtaskPlaceholder": "Ajouter une sous-tâche...",
    "subtaskCreateError": "Impossible de créer la sous-tâche",
    "selectParent": "Sélectionner la carte parente",
    "searchCards": "Rechercher une carte...",
    "noMatchingCards": "Aucune carte correspondante",
    "assignAsSubtask": "Assigner comme sous-tâche...",
    "deleteCard": "Supprimer la carte",
    "tooltipSubtask": "Sous-tâche",
    "tooltipComments": "Commentaires",
    "tooltipAttachments": "Pièces jointes",
    "tooltipSubtasks": "Sous-tâches",
    "addCard": "+ Ajouter une carte",
    "cardTitlePlaceholder": "Saisir le titre de la carte...",
    "move": "Déplacer la carte",
    "changeColumn": "Changer de colonne",
    "changeSwimlane": "Changer de couloir",
    "moveError": "Impossible de déplacer la carte"
  },
  "swimlane": {
    "addSwimlane": "+ Ajouter un couloir",
    "swimlaneName": "Nom du couloir...",
    "deleteError": "Erreur lors de la suppression du couloir"
  },
  "label": {
    "labels": "Étiquettes",
    "updateError": "Impossible de mettre à jour l'étiquette",
    "createError": "Impossible de créer l'étiquette",
    "confirmDelete": "Vraiment supprimer l'étiquette ? Elle sera retirée de toutes les cartes.",
    "deleteError": "Impossible de supprimer l'étiquette",
    "namePlaceholder": "Nom de l'étiquette...",
    "preview": "Aperçu :",
    "create": "Créer",
    "noLabels": "Aucune étiquette pour l'instant",
    "newLabel": "Créer une nouvelle étiquette"
  },
  "search": {
    "searchCards": "Rechercher des cartes...",
    "withDueDate": "Avec date d'échéance",
    "withoutDate": "Sans date",
    "searchPlaceholder": "Rechercher...",
    "minChars": "Saisissez au moins 2 caractères pour rechercher",
    "noResults": "Aucun résultat pour \"{{query}}\"",
    "navigate": "Naviguer",
    "open": "Ouvrir",
    "close": "Fermer"
  },
  "share": {
    "shareBoard": "Partager le tableau",
    "inviteByEmail": "Inviter par e-mail",
    "emailPlaceholder": "email@example.com",
    "read": "Lecture",
    "comment": "Commenter",
    "edit": "Modifier",
    "createLink": "Créer un lien",
    "invitedUsers": "Utilisateurs invités",
    "sharedLinks": "Liens partagés",
    "copyLink": "Copier le lien",
    "noShares": "Aucun partage pour l'instant. Invitez des utilisateurs ou créez un lien."
  },
  "calendar": {
    "today": "Aujourd'hui",
    "moreCards": "+{{count}} de plus",
    "months": {
      "0": "Janvier",
      "1": "Février",
      "2": "Mars",
      "3": "Avril",
      "4": "Mai",
      "5": "Juin",
      "6": "Juillet",
      "7": "Août",
      "8": "Septembre",
      "9": "Octobre",
      "10": "Novembre",
      "11": "Décembre"
    },
    "weekdays": {
      "0": "Lu",
      "1": "Ma",
      "2": "Me",
      "3": "Je",
      "4": "Ve",
      "5": "Sa",
      "6": "Di"
    }
  },
  "shortcuts": {
    "title": "Raccourcis clavier",
    "description": "Appuyez sur ? sur le tableau pour ouvrir cette boîte de dialogue"
  },
  "team": {
    "myTeams": "Mes équipes",
    "createTeam": "+ Créer une équipe",
    "teamName": "Nom de l'équipe",
    "loading": "Chargement...",
    "noTeams": "Vous n'êtes dans aucune équipe.",
    "createFirstTeam": "Créer la première équipe",
    "confirmDelete": "Vraiment supprimer cette équipe ?",
    "deleteTeam": "Supprimer l'équipe"
  },
  "activity": {
    "noActivity": "Aucune activité pour l'instant",
    "justNow": "à l'instant",
    "minutesAgo": "il y a {{count}}min",
    "hoursAgo": "il y a {{count}}h",
    "daysAgo": "il y a {{count}}j",
    "loadMore": "Charger plus"
  },
  "attachment": {
    "title": "Pièces jointes ({{count}})",
    "uploading": "Téléversement...",
    "upload": "Téléverser un fichier",
    "uploaded": "Fichier téléversé",
    "uploadError": "Échec du téléversement",
    "deleted": "Fichier supprimé",
    "deleteError": "Impossible de supprimer le fichier",
    "download": "Télécharger",
    "delete": "Supprimer"
  },
  "template": {
    "namePlaceholder": "Nom du modèle...",
    "saving": "...",
    "saved": "Enregistré !",
    "template": "Modèle",
    "saveAsTemplate": "Enregistrer comme modèle",
    "createBoard": "Créer un tableau",
    "selectTemplate": "Sélectionnez un modèle ou créez un tableau vide.",
    "boardName": "Nom du tableau",
    "defaultBoardName": "Mon tableau",
    "emptyBoard": "Tableau vide",
    "emptyBoardDesc": "Commencer avec un tableau vide (À faire, En cours, Terminé)",
    "loadingTemplates": "Chargement des modèles...",
    "systemTemplates": "Modèles système",
    "teamTemplates": "Modèles d'équipe",
    "swimlaneCount_one": "{{count}} couloir",
    "swimlaneCount_other": "{{count}} couloirs"
  },
  "sharedBoard": {
    "loading": "Chargement...",
    "accessDenied": "Accès refusé",
    "notFound": "Tableau introuvable",
    "sharedView": "Vue partagée — {{permission}}",
    "noRealtime": "Pas de mises à jour en temps réel"
  }
}
```

**Step 4: Create Italian translation file**

Create `apps/web/src/locales/it/translation.json`:

```json
{
  "common": {
    "save": "Salva",
    "saving": "Salvataggio...",
    "cancel": "Annulla",
    "delete": "Elimina",
    "edit": "Modifica",
    "add": "Aggiungi",
    "loading": "Caricamento...",
    "create": "Crea",
    "creating": "Creazione...",
    "close": "Chiudi",
    "rename": "Rinomina",
    "upload": "Carica",
    "download": "Scarica",
    "copy": "Copia",
    "search": "Cerca",
    "back": "Indietro",
    "invite": "Invita",
    "confirm": "Conferma"
  },
  "auth": {
    "signIn": "Accedi",
    "signingIn": "Accesso in corso...",
    "register": "Registrati",
    "registering": "Registrazione...",
    "email": "E-mail",
    "password": "Password",
    "name": "Nome",
    "or": "o",
    "loginWithGoogle": "Accedi con Google",
    "loginWithMicrosoft": "Accedi con Microsoft",
    "noAccount": "Non hai ancora un account?",
    "alreadyHaveAccount": "Hai già un account?",
    "loginFailed": "Accesso fallito",
    "registrationFailed": "Registrazione fallita"
  },
  "user": {
    "editProfile": "Modifica profilo",
    "changePassword": "Cambia password",
    "logout": "Esci",
    "displayName": "Nome",
    "email": "E-mail",
    "currentPassword": "Password attuale",
    "newPassword": "Nuova password",
    "confirmPassword": "Conferma password",
    "profileUpdated": "Profilo aggiornato",
    "passwordChanged": "Password modificata",
    "profileUpdateError": "Errore durante l'aggiornamento del profilo",
    "passwordChangeError": "Errore durante il cambio password",
    "wrongPassword": "La password attuale non è corretta",
    "emailInUse": "Questo indirizzo e-mail è già in uso",
    "appearance": "Aspetto",
    "language": "Lingua",
    "userProfile": "Profilo utente"
  },
  "theme": {
    "light": "Chiaro",
    "dark": "Scuro",
    "system": "Sistema"
  },
  "language": {
    "de": "Deutsch",
    "en": "English",
    "fr": "Français",
    "it": "Italiano"
  },
  "board": {
    "boards": "Bacheche",
    "backToTeams": "← Team",
    "backToBoards": "← Bacheche",
    "createBoard": "+ Crea bacheca",
    "noBoards": "Nessuna bacheca disponibile.",
    "share": "Condividi",
    "activity": "Attività",
    "filter": "Filtro",
    "allAssignees": "Tutti gli assegnatari",
    "overdue": "Scaduto",
    "thisWeek": "Questa settimana",
    "noDate": "Nessuna data",
    "calendar": "Calendario",
    "shortcuts": "Scorciatoie (?)",
    "cardsCount": "{{filtered}}/{{total}} Schede",
    "deleteColumn": "Elimina colonna",
    "columnNotEmpty": "La colonna non può essere eliminata perché contiene ancora delle schede",
    "confirmDeleteColumn": "Eliminare davvero la colonna \"{{name}}\"?",
    "columnDeleted": "Colonna eliminata",
    "columnDeleteError": "Impossibile eliminare la colonna"
  },
  "column": {
    "addColumn": "+ Aggiungi colonna",
    "columnName": "Nome colonna..."
  },
  "card": {
    "cardDetails": "Dettagli scheda",
    "cardType": "Tipo di scheda",
    "description": "Descrizione",
    "addDescription": "Aggiungi descrizione...",
    "noDescription": "Nessuna descrizione",
    "labels": "Etichette",
    "loadError": "Impossibile caricare la scheda",
    "titleSaveError": "Impossibile salvare il titolo",
    "descriptionSaveError": "Impossibile salvare la descrizione",
    "typeChangeError": "Impossibile cambiare il tipo di scheda",
    "confirmDelete": "Eliminare davvero la scheda?",
    "deleted": "Scheda eliminata",
    "deleteError": "Impossibile eliminare la scheda",
    "column": "Colonna: {{name}}",
    "swimlane": "Corsia: {{name}}",
    "assignees": "Assegnato",
    "subtaskOf": "Sottoattività di:",
    "linkRemoved": "Collegamento rimosso",
    "linkRemoveError": "Impossibile rimuovere il collegamento",
    "dueDate": "Data di scadenza",
    "addDueDate": "Imposta data di scadenza...",
    "dueDateSaveError": "Impossibile salvare la data di scadenza",
    "dueDateRemoveError": "Impossibile rimuovere la data di scadenza",
    "overdue": "(Scaduto)",
    "soon": "In scadenza",
    "comments": "Commenti",
    "commentAddError": "Impossibile aggiungere il commento",
    "commentUpdateError": "Impossibile aggiornare il commento",
    "commentDeleteError": "Impossibile eliminare il commento",
    "commentPlaceholder": "Scrivi un commento...",
    "submitComment": "Invia commento",
    "subtasks": "Sottoattività",
    "addSubtask": "+ Aggiungi sottoattività",
    "subtaskPlaceholder": "Aggiungi sottoattività...",
    "subtaskCreateError": "Impossibile creare la sottoattività",
    "selectParent": "Seleziona scheda padre",
    "searchCards": "Cerca schede...",
    "noMatchingCards": "Nessuna scheda corrispondente trovata",
    "assignAsSubtask": "Assegna come sottoattività...",
    "deleteCard": "Elimina scheda",
    "tooltipSubtask": "Sottoattività",
    "tooltipComments": "Commenti",
    "tooltipAttachments": "Allegati",
    "tooltipSubtasks": "Sottoattività",
    "addCard": "+ Aggiungi scheda",
    "cardTitlePlaceholder": "Inserisci il titolo della scheda...",
    "move": "Sposta scheda",
    "changeColumn": "Cambia colonna",
    "changeSwimlane": "Cambia corsia",
    "moveError": "Impossibile spostare la scheda"
  },
  "swimlane": {
    "addSwimlane": "+ Aggiungi corsia",
    "swimlaneName": "Nome corsia...",
    "deleteError": "Errore durante l'eliminazione della corsia"
  },
  "label": {
    "labels": "Etichette",
    "updateError": "Impossibile aggiornare l'etichetta",
    "createError": "Impossibile creare l'etichetta",
    "confirmDelete": "Eliminare davvero l'etichetta? Verrà rimossa da tutte le schede.",
    "deleteError": "Impossibile eliminare l'etichetta",
    "namePlaceholder": "Nome etichetta...",
    "preview": "Anteprima:",
    "create": "Crea",
    "noLabels": "Nessuna etichetta disponibile",
    "newLabel": "Crea nuova etichetta"
  },
  "search": {
    "searchCards": "Cerca schede...",
    "withDueDate": "Con data di scadenza",
    "withoutDate": "Senza data",
    "searchPlaceholder": "Cerca...",
    "minChars": "Inserisci almeno 2 caratteri per cercare",
    "noResults": "Nessun risultato per \"{{query}}\"",
    "navigate": "Naviga",
    "open": "Apri",
    "close": "Chiudi"
  },
  "share": {
    "shareBoard": "Condividi bacheca",
    "inviteByEmail": "Invita per e-mail",
    "emailPlaceholder": "email@example.com",
    "read": "Lettura",
    "comment": "Commenta",
    "edit": "Modifica",
    "createLink": "Crea link",
    "invitedUsers": "Utenti invitati",
    "sharedLinks": "Link condivisi",
    "copyLink": "Copia link",
    "noShares": "Nessuna condivisione. Invita utenti o crea un link."
  },
  "calendar": {
    "today": "Oggi",
    "moreCards": "+{{count}} altro",
    "months": {
      "0": "Gennaio",
      "1": "Febbraio",
      "2": "Marzo",
      "3": "Aprile",
      "4": "Maggio",
      "5": "Giugno",
      "6": "Luglio",
      "7": "Agosto",
      "8": "Settembre",
      "9": "Ottobre",
      "10": "Novembre",
      "11": "Dicembre"
    },
    "weekdays": {
      "0": "Lu",
      "1": "Ma",
      "2": "Me",
      "3": "Gi",
      "4": "Ve",
      "5": "Sa",
      "6": "Do"
    }
  },
  "shortcuts": {
    "title": "Scorciatoie da tastiera",
    "description": "Premi ? sulla bacheca per aprire questa finestra"
  },
  "team": {
    "myTeams": "I miei team",
    "createTeam": "+ Crea team",
    "teamName": "Nome team",
    "loading": "Caricamento...",
    "noTeams": "Non fai parte di nessun team.",
    "createFirstTeam": "Crea il primo team",
    "confirmDelete": "Eliminare davvero questo team?",
    "deleteTeam": "Elimina team"
  },
  "activity": {
    "noActivity": "Nessuna attività",
    "justNow": "proprio ora",
    "minutesAgo": "{{count}}min fa",
    "hoursAgo": "{{count}}h fa",
    "daysAgo": "{{count}}gg fa",
    "loadMore": "Carica altro"
  },
  "attachment": {
    "title": "Allegati ({{count}})",
    "uploading": "Caricamento...",
    "upload": "Carica file",
    "uploaded": "File caricato",
    "uploadError": "Caricamento fallito",
    "deleted": "File eliminato",
    "deleteError": "Impossibile eliminare il file",
    "download": "Scarica",
    "delete": "Elimina"
  },
  "template": {
    "namePlaceholder": "Nome modello...",
    "saving": "...",
    "saved": "Salvato!",
    "template": "Modello",
    "saveAsTemplate": "Salva come modello",
    "createBoard": "Crea bacheca",
    "selectTemplate": "Seleziona un modello o crea una bacheca vuota.",
    "boardName": "Nome bacheca",
    "defaultBoardName": "La mia bacheca",
    "emptyBoard": "Bacheca vuota",
    "emptyBoardDesc": "Inizia con una bacheca vuota (Da fare, In corso, Fatto)",
    "loadingTemplates": "Caricamento modelli...",
    "systemTemplates": "Modelli di sistema",
    "teamTemplates": "Modelli del team",
    "swimlaneCount_one": "{{count}} corsia",
    "swimlaneCount_other": "{{count}} corsie"
  },
  "sharedBoard": {
    "loading": "Caricamento...",
    "accessDenied": "Accesso negato",
    "notFound": "Bacheca non trovata",
    "sharedView": "Vista condivisa — {{permission}}",
    "noRealtime": "Nessun aggiornamento in tempo reale"
  }
}
```

**Step 5: Commit**

```bash
git add apps/web/src/locales/
git commit -m "feat: add translation files for EN, DE, FR, IT"
```

---

## Task 7: Create i18n config and wire into app

**Files:**
- Create: `apps/web/src/i18n.ts`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/index.html`

**Step 1: Create i18n.ts**

Create `apps/web/src/i18n.ts`:

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en/translation.json';
import deTranslation from './locales/de/translation.json';
import frTranslation from './locales/fr/translation.json';
import itTranslation from './locales/it/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      de: { translation: deTranslation },
      fr: { translation: frTranslation },
      it: { translation: itTranslation },
    },
    supportedLngs: ['en', 'de', 'fr', 'it'],
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
```

**Step 2: Import i18n in main.tsx**

Replace `apps/web/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './i18n.js';
import './main.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

**Step 3: Remove hardcoded lang="de" from index.html**

Edit `apps/web/index.html`, change:
```html
<html lang="de">
```
to:
```html
<html lang="en">
```

(i18n.ts will update it dynamically on `languageChanged`.)

**Step 4: Verify build**

```bash
cd /Users/gerrit/Code/trello-clone/.claude/worktrees/great-proskuriakova/apps/web
pnpm build
```

Expected: builds cleanly. If TypeScript complains about JSON imports, add `"resolveJsonModule": true` to `apps/web/tsconfig.json` compilerOptions.

**Step 5: Commit**

```bash
git add apps/web/src/i18n.ts apps/web/src/main.tsx apps/web/index.html
git commit -m "feat: configure i18next with browser language detection"
```

---

## Task 8: Create LanguageSelector component

**Files:**
- Create: `apps/web/src/components/LanguageSelector.tsx`

**Step 1: Create LanguageSelector**

Create `apps/web/src/components/LanguageSelector.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore.js';
import { updateProfile } from '../api/users.api.js';

const LANGUAGES = [
  { code: 'de', label: 'DE' },
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'it', label: 'IT' },
] as const;

interface LanguageSelectorProps {
  className?: string;
}

export function LanguageSelector({ className }: LanguageSelectorProps) {
  const { i18n } = useTranslation();
  const { user, setUser } = useAuthStore();

  const handleChange = async (code: string) => {
    await i18n.changeLanguage(code);
    if (user) {
      try {
        const { user: updated } = await updateProfile({
          displayName: user.displayName,
          email: user.email,
          language: code as 'en' | 'de' | 'fr' | 'it',
        });
        setUser(updated);
      } catch {
        // language change still applied locally even if save fails
      }
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => handleChange(code)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            i18n.language === code
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/LanguageSelector.tsx
git commit -m "feat: add LanguageSelector component"
```

---

## Task 9: Update authStore to apply language on login

**Files:**
- Modify: `apps/web/src/stores/authStore.ts`

**Step 1: Update authStore to call i18n.changeLanguage when user is set**

Replace the full content of `apps/web/src/stores/authStore.ts`:

```ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { User } from '@trello-clone/shared';
import i18n from '../i18n.js';

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

function applyLanguage(user: User) {
  if (user.language && user.language !== i18n.language) {
    i18n.changeLanguage(user.language);
  }
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      accessToken: null,
      isLoading: true,
      setAuth: (user, accessToken) => {
        applyLanguage(user);
        set({ user, accessToken, isLoading: false });
      },
      setAccessToken: (accessToken) => set({ accessToken }),
      setUser: (user) => {
        applyLanguage(user);
        set({ user });
      },
      logout: () => set({ user: null, accessToken: null, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    { name: 'AuthStore' },
  ),
);
```

**Step 2: Commit**

```bash
git add apps/web/src/stores/authStore.ts
git commit -m "feat: apply user language preference on login/profile update"
```

---

## Task 10: Update LoginPage and RegisterPage

**Files:**
- Modify: `apps/web/src/features/auth/LoginPage.tsx`
- Modify: `apps/web/src/features/auth/RegisterPage.tsx`

**Step 1: Replace LoginPage.tsx**

```tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { loginSchema, type LoginInput } from '@trello-clone/shared';
import { loginUser } from '../../api/auth.api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { AuthLayout } from '../../components/layout/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { LanguageSelector } from '../../components/LanguageSelector.js';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');
  const { t } = useTranslation();

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.error || t('auth.loginFailed'));
    }
  };

  return (
    <AuthLayout>
      <div className="flex justify-end mb-4">
        <LanguageSelector />
      </div>

      <h2 className="text-xl font-semibold dark:text-gray-100 mb-6">{t('auth.signIn')}</h2>

      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label={t('auth.email')} type="email" {...register('email')} error={errors.email?.message} />
        <Input label={t('auth.password')} type="password" {...register('password')} error={errors.password?.message} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white dark:bg-gray-800 px-2 text-gray-500 dark:text-gray-400">{t('auth.or')}</span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <a
            href="/api/v1/auth/google"
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {t('auth.loginWithGoogle')}
          </a>
          <a
            href="/api/v1/auth/microsoft"
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {t('auth.loginWithMicrosoft')}
          </a>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="text-blue-600 hover:underline">
          {t('auth.register')}
        </Link>
      </p>
    </AuthLayout>
  );
}
```

**Step 2: Replace RegisterPage.tsx**

```tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { registerSchema, type RegisterInput } from '@trello-clone/shared';
import { registerUser } from '../../api/auth.api.js';
import { useAuthStore } from '../../stores/authStore.js';
import { AuthLayout } from '../../components/layout/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { LanguageSelector } from '../../components/LanguageSelector.js';
import i18n from '../../i18n.js';

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterInput) => {
    try {
      setError('');
      const { user, accessToken } = await registerUser({
        ...data,
        language: i18n.language as 'en' | 'de' | 'fr' | 'it',
      });
      setAuth(user, accessToken);
      navigate('/teams');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.error || t('auth.registrationFailed'));
    }
  };

  return (
    <AuthLayout>
      <div className="flex justify-end mb-4">
        <LanguageSelector />
      </div>

      <h2 className="text-xl font-semibold dark:text-gray-100 mb-6">{t('auth.register')}</h2>

      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label={t('auth.name')} {...register('displayName')} error={errors.displayName?.message} />
        <Input label={t('auth.email')} type="email" {...register('email')} error={errors.email?.message} />
        <Input label={t('auth.password')} type="password" {...register('password')} error={errors.password?.message} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t('auth.registering') : t('auth.register')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        {t('auth.alreadyHaveAccount')}{' '}
        <Link to="/login" className="text-blue-600 hover:underline">
          {t('auth.signIn')}
        </Link>
      </p>
    </AuthLayout>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/features/auth/LoginPage.tsx apps/web/src/features/auth/RegisterPage.tsx
git commit -m "feat: add i18n and LanguageSelector to login and register pages"
```

---

## Task 11: Update UserMenu, EditProfileModal, ChangePasswordModal

**Files:**
- Modify: `apps/web/src/features/auth/UserMenu.tsx`
- Modify: `apps/web/src/features/auth/EditProfileModal.tsx`
- Modify: `apps/web/src/features/auth/ChangePasswordModal.tsx`

**Step 1: Replace UserMenu.tsx**

```tsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Sun, Moon, Monitor, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore.js';
import { useThemeStore } from '../../stores/themeStore.js';
import { logoutUser } from '../../api/auth.api.js';
import { EditProfileModal } from './EditProfileModal.js';
import { ChangePasswordModal } from './ChangePasswordModal.js';
import { LanguageSelector } from '../../components/LanguageSelector.js';

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { preference, setPreference } = useThemeStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    await logoutUser();
    logout();
    navigate('/login');
  };

  const initials =
    user?.displayName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? '?';

  return (
    <>
      <div className="relative" ref={popoverRef}>
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label={t('user.userProfile')}
          aria-expanded={isOpen}
        >
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initials}
          </div>
          <span className="text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">{user?.displayName}</span>
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{user?.displayName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
            </div>
            <div className="py-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowEditProfile(true);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('user.editProfile')}
              </button>
              {user?.hasPassword && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setShowChangePassword(true);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('user.changePassword')}
                </button>
              )}
            </div>
            {/* Appearance section */}
            <div className="py-2 border-t border-gray-100 dark:border-gray-700">
              <p className="px-4 pb-1 text-xs font-medium text-gray-500 dark:text-gray-400">{t('user.appearance')}</p>
              <div className="flex items-center gap-1 px-3">
                {([
                  { value: 'light', icon: Sun, labelKey: 'theme.light' },
                  { value: 'system', icon: Monitor, labelKey: 'theme.system' },
                  { value: 'dark', icon: Moon, labelKey: 'theme.dark' },
                ] as const).map(({ value, icon: Icon, labelKey }) => (
                  <button
                    key={value}
                    onClick={() => setPreference(value)}
                    className={`flex-1 flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg text-xs transition-colors ${
                      preference === value
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    title={t(labelKey)}
                  >
                    <Icon size={14} />
                    {t(labelKey)}
                  </button>
                ))}
              </div>
            </div>
            {/* Language section */}
            <div className="py-2 border-t border-gray-100 dark:border-gray-700">
              <p className="px-4 pb-1 text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Globe size={12} />
                {t('user.language')}
              </p>
              <div className="px-3">
                <LanguageSelector />
              </div>
            </div>
            <div className="py-1 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('user.logout')}
              </button>
            </div>
          </div>
        )}
      </div>

      <EditProfileModal isOpen={showEditProfile} onClose={() => setShowEditProfile(false)} />
      <ChangePasswordModal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </>
  );
}
```

**Step 2: Replace EditProfileModal.tsx**

```tsx
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../components/ui/Modal.js';
import { Input } from '../../components/ui/Input.js';
import { Button } from '../../components/ui/Button.js';
import { useAuthStore } from '../../stores/authStore.js';
import { updateProfile } from '../../api/users.api.js';
import { updateProfileSchema, type UpdateProfileInput } from '@trello-clone/shared';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { user, setUser } = useAuthStore();
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({ resolver: zodResolver(updateProfileSchema) });

  useEffect(() => {
    if (isOpen) {
      reset({ displayName: user?.displayName ?? '', email: user?.email ?? '' });
    }
  }, [isOpen, user, reset]);

  const onSubmit = async (data: UpdateProfileInput) => {
    try {
      const { user: updated } = await updateProfile(data);
      setUser(updated);
      toast.success(t('user.profileUpdated'));
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError('email', { message: t('user.emailInUse') });
      } else {
        toast.error(t('user.profileUpdateError'));
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('user.editProfile')}>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('user.editProfile')}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label={t('user.displayName')} {...register('displayName')} error={errors.displayName?.message} />
          <Input label={t('user.email')} type="email" {...register('email')} error={errors.email?.message} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
```

**Step 3: Replace ChangePasswordModal.tsx**

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../components/ui/Modal.js';
import { Input } from '../../components/ui/Input.js';
import { Button } from '../../components/ui/Button.js';
import { changePassword } from '../../api/users.api.js';
import { changePasswordSchema, type ChangePasswordInput } from '@trello-clone/shared';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: ChangePasswordInput) => {
    try {
      await changePassword(data);
      toast.success(t('user.passwordChanged'));
      reset();
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        setError('currentPassword', { message: t('user.wrongPassword') });
      } else {
        toast.error(t('user.passwordChangeError'));
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('user.changePassword')}>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('user.changePassword')}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label={t('user.currentPassword')}
            type="password"
            {...register('currentPassword')}
            error={errors.currentPassword?.message}
          />
          <Input
            label={t('user.newPassword')}
            type="password"
            {...register('newPassword')}
            error={errors.newPassword?.message}
          />
          <Input
            label={t('user.confirmPassword')}
            type="password"
            {...register('confirmPassword')}
            error={errors.confirmPassword?.message}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
```

**Step 4: Commit**

```bash
git add apps/web/src/features/auth/UserMenu.tsx apps/web/src/features/auth/EditProfileModal.tsx apps/web/src/features/auth/ChangePasswordModal.tsx
git commit -m "feat: add i18n to UserMenu, EditProfileModal, ChangePasswordModal"
```

---

## Task 12: i18n the board feature components (batch 1 — BoardListPage, BoardPage)

**Files:**
- Modify: `apps/web/src/features/boards/BoardListPage.tsx`
- Modify: `apps/web/src/features/boards/BoardPage.tsx`

For each file: read the file, add `import { useTranslation } from 'react-i18next';` at the top, add `const { t } = useTranslation();` inside the component, then replace every hardcoded German string with the appropriate `t('key')` call using the keys defined in Task 6.

**Key mapping for BoardListPage:**
- `"← Teams"` → `t('board.backToTeams')`
- `"Boards"` → `t('board.boards')`
- `"Erstellen..."` → `t('common.creating')`
- `"+ Board erstellen"` → `t('board.createBoard')`
- `"Laden..."` → `t('common.loading')`
- `"Noch keine Boards vorhanden."` → `t('board.noBoards')`

**Key mapping for BoardPage:**
- `"Spalte kann nicht gelöscht werden..."` → `t('board.columnNotEmpty')`
- `"Spalte \"{name}\" wirklich löschen?"` → `t('board.confirmDeleteColumn', { name })`
- `"Spalte gelöscht"` → `t('board.columnDeleted')`
- `"Spalte konnte nicht gelöscht werden"` → `t('board.columnDeleteError')`
- `"Spalte löschen"` → `t('board.deleteColumn')`
- `"← Boards"` → `t('board.backToBoards')`
- `"Teilen"` → `t('board.share')`
- `"Aktivität"` → `t('board.activity')`
- `"Filter"` → `t('board.filter')`
- `"Alle Zuständigen"` → `t('board.allAssignees')`
- `"Überfällig"` → `t('board.overdue')`
- `"Diese Woche"` → `t('board.thisWeek')`
- `"Kein Datum"` → `t('board.noDate')`
- `"Kalender"` → `t('board.calendar')`
- `"Tastaturkürzel (?)"` → `t('board.shortcuts')`
- `"{filtered}/{total} Karten"` → `t('board.cardsCount', { filtered, total })`

**Step 1: Edit both files per key mapping above**

**Step 2: Build to verify**

```bash
cd /Users/gerrit/Code/trello-clone/.claude/worktrees/great-proskuriakova/apps/web
pnpm build
```

**Step 3: Commit**

```bash
git add apps/web/src/features/boards/BoardListPage.tsx apps/web/src/features/boards/BoardPage.tsx
git commit -m "feat: add i18n to BoardListPage and BoardPage"
```

---

## Task 13: i18n board components batch 2 — CardDetailModal

**Files:**
- Modify: `apps/web/src/features/boards/CardDetailModal.tsx`

This is the largest component. Add `useTranslation` and replace all German strings using keys from the `card.*` namespace defined in Task 6.

Key replacements include all `toast.success(...)`, `toast.error(...)`, `window.confirm(...)`, label text, button text, placeholder text, and inline error strings. Use `t('card.<key>')` per the translation keys defined above.

For the confirmation dialogs that use `window.confirm(...)`, replace the German string argument with the `t(...)` call, e.g.:
```tsx
if (!window.confirm(t('card.confirmDelete'))) return;
```

**Step 1: Edit CardDetailModal.tsx** — add `useTranslation` import and hook, replace all ~30 German strings.

**Step 2: Commit**

```bash
git add apps/web/src/features/boards/CardDetailModal.tsx
git commit -m "feat: add i18n to CardDetailModal"
```

---

## Task 14: i18n board components batch 3 — card/column/swimlane small components

**Files:**
- Modify: `apps/web/src/features/boards/CardComponent.tsx`
- Modify: `apps/web/src/features/boards/ColumnComponent.tsx`
- Modify: `apps/web/src/features/boards/AddCardForm.tsx`
- Modify: `apps/web/src/features/boards/AddColumnForm.tsx`
- Modify: `apps/web/src/features/boards/AddSwimlaneForm.tsx`
- Modify: `apps/web/src/features/boards/SwimlaneRow.tsx`

**Key mapping:**

CardComponent:
- `"Überfällig"` → `t('board.overdue')`
- `"Bald fällig"` → `t('card.soon')`
- `"Unteraufgabe"` → `t('card.tooltipSubtask')`
- `"Kommentare"` → `t('card.tooltipComments')`
- `"Anhänge"` → `t('card.tooltipAttachments')`
- `"Unteraufgaben"` → `t('card.tooltipSubtasks')`

ColumnComponent (same as BoardPage column strings):
- `t('board.columnNotEmpty')`, `t('board.confirmDeleteColumn', { name })`, `t('board.columnDeleted')`, `t('board.columnDeleteError')`, `t('board.deleteColumn')`

AddCardForm:
- `"+ Karte hinzufügen"` → `t('card.addCard')`
- `"Kartentitel eingeben..."` → `t('card.cardTitlePlaceholder')`
- `"Hinzufügen"` → `t('common.add')`
- `"Abbrechen"` → `t('common.cancel')`

AddColumnForm:
- `"+ Spalte hinzufügen"` → `t('column.addColumn')`
- `"Spaltenname..."` → `t('column.columnName')`
- `"Hinzufügen"` → `t('common.add')`
- `"Abbrechen"` → `t('common.cancel')`

AddSwimlaneForm:
- `"+ Swimlane hinzufügen"` → `t('swimlane.addSwimlane')`
- `"Swimlane-Name..."` → `t('swimlane.swimlaneName')`
- `"Hinzufügen"` → `t('common.add')`
- `"Abbrechen"` → `t('common.cancel')`

SwimlaneRow:
- `"Speichern"` → `t('common.save')`
- `"Abbrechen"` → `t('common.cancel')`
- `"Umbenennen"` → `t('common.rename')`
- `"Löschen"` → `t('common.delete')`
- `"Fehler beim Löschen der Swimlane"` → `t('swimlane.deleteError')`

**Step 1: Edit all 6 files per key mappings above**

**Step 2: Commit**

```bash
git add apps/web/src/features/boards/CardComponent.tsx apps/web/src/features/boards/ColumnComponent.tsx apps/web/src/features/boards/AddCardForm.tsx apps/web/src/features/boards/AddColumnForm.tsx apps/web/src/features/boards/AddSwimlaneForm.tsx apps/web/src/features/boards/SwimlaneRow.tsx
git commit -m "feat: add i18n to card, column, and swimlane components"
```

---

## Task 15: i18n board components batch 4 — LabelPicker and MoveCardPopover

**Files:**
- Modify: `apps/web/src/features/boards/LabelPicker.tsx`
- Modify: `apps/web/src/features/boards/MoveCardPopover.tsx`

**Key mapping LabelPicker:**
- `"Labels"` → `t('label.labels')`
- `"Label konnte nicht aktualisiert werden"` → `t('label.updateError')`
- `"Label konnte nicht erstellt werden"` → `t('label.createError')`
- `"Label wirklich löschen? Es wird von allen Karten entfernt."` → `t('label.confirmDelete')`
- `"Label konnte nicht gelöscht werden"` → `t('label.deleteError')`
- `"Label-Name..."` → `t('label.namePlaceholder')`
- `"Vorschau:"` → `t('label.preview')`
- `"Speichern"` → `t('common.save')`
- `"Erstellen"` → `t('label.create')`
- `"Abbrechen"` → `t('common.cancel')`
- `"Noch keine Labels vorhanden"` → `t('label.noLabels')`
- `"Neues Label erstellen"` → `t('label.newLabel')`

**Key mapping MoveCardPopover:**
- `"Karte verschieben"` → `t('card.move')`
- `"Spalte wechseln"` → `t('card.changeColumn')`
- `"Swimlane wechseln"` → `t('card.changeSwimlane')`
- `"Karte konnte nicht verschoben werden"` → `t('card.moveError')`

**Step 1: Edit both files**

**Step 2: Commit**

```bash
git add apps/web/src/features/boards/LabelPicker.tsx apps/web/src/features/boards/MoveCardPopover.tsx
git commit -m "feat: add i18n to LabelPicker and MoveCardPopover"
```

---

## Task 16: i18n board components batch 5 — CommandPalette and ShortcutHelpModal

**Files:**
- Modify: `apps/web/src/features/boards/CommandPalette.tsx`
- Modify: `apps/web/src/features/boards/ShortcutHelpModal.tsx`

**Key mapping CommandPalette:**
- `"Suche"` → `t('common.search')`
- `"Karten suchen..."` → `t('search.searchCards')`
- `"Mit Fälligkeitsdatum"` → `t('search.withDueDate')`
- `"Ohne Datum"` → `t('search.withoutDate')`
- `"Suche..."` → `t('search.searchPlaceholder')`
- `"Mindestens 2 Zeichen eingeben, um zu suchen"` → `t('search.minChars')`
- `"Keine Ergebnisse für \"{query}\""` → `t('search.noResults', { query })`
- `"Navigieren"` → `t('search.navigate')`
- `"Öffnen"` → `t('search.open')`
- `"Schliessen"` → `t('search.close')`

**Key mapping ShortcutHelpModal:**
- `"Tastaturkürzel"` → `t('shortcuts.title')`
- `"Drücke ? auf dem Board um diesen Dialog zu öffnen"` → `t('shortcuts.description')`

**Step 1: Edit both files**

**Step 2: Commit**

```bash
git add apps/web/src/features/boards/CommandPalette.tsx apps/web/src/features/boards/ShortcutHelpModal.tsx
git commit -m "feat: add i18n to CommandPalette and ShortcutHelpModal"
```

---

## Task 17: i18n board components batch 6 — ShareBoardModal and CalendarPage

**Files:**
- Modify: `apps/web/src/features/boards/ShareBoardModal.tsx`
- Modify: `apps/web/src/features/boards/CalendarPage.tsx`

**Key mapping ShareBoardModal:**
- `"Board teilen"` → `t('share.shareBoard')`
- `"Per Email einladen"` → `t('share.inviteByEmail')`
- `"email@example.com"` (placeholder) → `t('share.emailPlaceholder')`
- `"Lesen"` → `t('share.read')`
- `"Kommentieren"` → `t('share.comment')`
- `"Bearbeiten"` → `t('share.edit')`
- `"Einladen"` → `t('common.invite')`
- `"Link erstellen"` → `t('share.createLink')`
- `"Laden..."` → `t('common.loading')`
- `"Eingeladene Benutzer"` → `t('share.invitedUsers')`
- `"Geteilte Links"` → `t('share.sharedLinks')`
- `"Link kopieren"` → `t('share.copyLink')`
- `"Noch keine Freigaben..."` → `t('share.noShares')`

**Key mapping CalendarPage:**
The calendar uses month names and weekday arrays. Replace them with `t('calendar.months.N')` and `t('calendar.weekdays.N')`.

For example, where there is currently an array like:
```ts
const MONTHS = ['Januar', 'Februar', ..., 'Dezember'];
```
Replace with a function that reads from translations:
```ts
const MONTHS = Array.from({ length: 12 }, (_, i) => t(`calendar.months.${i}`));
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => t(`calendar.weekdays.${i}`));
```

Also replace:
- `"Heute"` → `t('calendar.today')`
- `"+{n} weitere"` → `t('calendar.moreCards', { count: n })`

**Step 1: Edit both files**

**Step 2: Commit**

```bash
git add apps/web/src/features/boards/ShareBoardModal.tsx apps/web/src/features/boards/CalendarPage.tsx
git commit -m "feat: add i18n to ShareBoardModal and CalendarPage"
```

---

## Task 18: i18n board components batch 7 — ActivityFeed, AttachmentSection, SaveAsTemplateButton, TemplatePicker, SharedBoardPage

**Files:**
- Modify: `apps/web/src/features/boards/ActivityFeed.tsx`
- Modify: `apps/web/src/features/boards/AttachmentSection.tsx`
- Modify: `apps/web/src/features/boards/SaveAsTemplateButton.tsx`
- Modify: `apps/web/src/features/boards/TemplatePicker.tsx`
- Modify: `apps/web/src/features/boards/SharedBoardPage.tsx`

**Key mappings:**

ActivityFeed:
- `"Noch keine Aktivität"` → `t('activity.noActivity')`
- `"gerade eben"` → `t('activity.justNow')`
- `"vor {n}m"` → `t('activity.minutesAgo', { count: n })`
- `"vor {n}h"` → `t('activity.hoursAgo', { count: n })`
- `"vor {n}d"` → `t('activity.daysAgo', { count: n })`
- `"Mehr laden"` → `t('activity.loadMore')`

AttachmentSection:
- `"Anhänge ({n})"` → `t('attachment.title', { count: n })`
- `"Hochladen..."` → `t('attachment.uploading')`
- `"Datei hochladen"` → `t('attachment.upload')`
- `"Datei hochgeladen"` → `t('attachment.uploaded')`
- `"Upload fehlgeschlagen"` → `t('attachment.uploadError')`
- `"Datei gelöscht"` → `t('attachment.deleted')`
- `"Datei konnte nicht gelöscht werden"` → `t('attachment.deleteError')`
- `"Herunterladen"` → `t('attachment.download')`
- `"Löschen"` → `t('attachment.delete')`

SaveAsTemplateButton:
- `"Vorlagenname..."` → `t('template.namePlaceholder')`
- `"..."` (saving state) → `t('template.saving')`
- `"Gespeichert!"` → `t('template.saved')`
- `"Vorlage"` → `t('template.template')`
- `"Als Vorlage speichern"` → `t('template.saveAsTemplate')`

TemplatePicker:
- `"Board erstellen"` (title) → `t('template.createBoard')`
- `"Wähle eine Vorlage..."` → `t('template.selectTemplate')`
- `"Board-Name"` → `t('template.boardName')`
- `"Mein Board"` → `t('template.defaultBoardName')`
- `"Leeres Board"` → `t('template.emptyBoard')`
- `"Beginne mit einem leeren Board..."` → `t('template.emptyBoardDesc')`
- `"Vorlagen laden..."` → `t('template.loadingTemplates')`
- `"System-Vorlagen"` → `t('template.systemTemplates')`
- `"Team-Vorlagen"` → `t('template.teamTemplates')`
- `"Abbrechen"` → `t('common.cancel')`
- `"Board erstellen"` (button) → `t('template.createBoard')`
- `"{n} Swimlane{s}"` → `t('template.swimlaneCount', { count: n })`

SharedBoardPage:
- `"Laden..."` → `t('sharedBoard.loading')`
- `"Zugriff nicht möglich"` → `t('sharedBoard.accessDenied')`
- `"Board nicht gefunden"` → `t('sharedBoard.notFound')`
- `"Geteilte Ansicht — {permission}"` → `t('sharedBoard.sharedView', { permission })`
- `"Kein Echtzeit-Update"` → `t('sharedBoard.noRealtime')`

**Step 1: Edit all 5 files per key mappings above**

**Step 2: Commit**

```bash
git add apps/web/src/features/boards/ActivityFeed.tsx apps/web/src/features/boards/AttachmentSection.tsx apps/web/src/features/boards/SaveAsTemplateButton.tsx apps/web/src/features/boards/TemplatePicker.tsx apps/web/src/features/boards/SharedBoardPage.tsx
git commit -m "feat: add i18n to ActivityFeed, Attachments, Templates, SharedBoard"
```

---

## Task 19: i18n TeamsPage and App.tsx

**Files:**
- Modify: `apps/web/src/features/teams/TeamsPage.tsx`
- Modify: `apps/web/src/App.tsx`

**Key mapping TeamsPage:**
- `"Meine Teams"` → `t('team.myTeams')`
- `"+ Team erstellen"` → `t('team.createTeam')`
- `"Team Name"` → `t('team.teamName')`
- `"Erstellen..."` → `t('common.creating')`
- `"Erstellen"` → `t('common.create')`
- `"Abbrechen"` → `t('common.cancel')`
- `"Laden..."` → `t('common.loading')`
- `"Du bist noch in keinem Team."` → `t('team.noTeams')`
- `"Erstes Team erstellen"` → `t('team.createFirstTeam')`
- `"Möchtest du dieses Team wirklich löschen?"` → `t('team.confirmDelete')`
- `"Team löschen"` → `t('team.deleteTeam')`

**Key mapping App.tsx:**
The `AuthGuard` component renders `"Laden..."` while checking auth. Replace with `t('common.loading')`. Add `useTranslation` to the `AuthGuard` function inside `App.tsx`.

**Step 1: Edit both files**

**Step 2: Final build**

```bash
cd /Users/gerrit/Code/trello-clone/.claude/worktrees/great-proskuriakova
pnpm build
```

Expected: all packages build cleanly with no TypeScript errors.

**Step 3: Run tests**

```bash
pnpm test
```

Expected: all tests pass.

**Step 4: Commit**

```bash
git add apps/web/src/features/teams/TeamsPage.tsx apps/web/src/App.tsx
git commit -m "feat: add i18n to TeamsPage and App AuthGuard"
```

---

## Task 20: End-to-end verification

**Step 1: Start dev servers**

```bash
cd /Users/gerrit/Code/trello-clone/.claude/worktrees/great-proskuriakova
pnpm dev
```

**Step 2: Verify language selector on login page**
- Open `http://localhost:5173/login`
- Confirm language selector (DE | EN | FR | IT) is visible
- Click each language — UI text updates immediately
- Refresh page — selected language persists

**Step 3: Verify language saved on login**
- Select FR on the login page
- Log in with valid credentials
- Confirm UI stays in French
- Open user menu — language section shows FR highlighted
- Change to IT in the user menu
- Log out and log back in — UI should be in IT (from DB)

**Step 4: Verify registration language**
- Go to `/register`, select DE
- Register a new user
- After registration, open user menu — language should be DE

**Step 5: Confirm all major views are translated**
- Navigate to Teams, Boards, Card detail, Calendar
- Confirm no hardcoded German strings remain in the target pages

**Step 6: Final commit (if any last fixes)**

```bash
git add -p
git commit -m "fix: i18n cleanup after verification"
```
