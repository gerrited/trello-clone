# Password Reset Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to reset their password via an email link using Resend, with full i18n support in 5 languages.

**Architecture:** DB-backed reset tokens (SHA-256 hashed) stored in a new `password_reset_tokens` table. Two new API endpoints (`POST /auth/forgot-password`, `POST /auth/reset-password`) handle token generation/verification. Two new frontend pages handle the user-facing flow.

**Tech Stack:** Resend SDK (new), Node.js `crypto` (existing), Drizzle ORM (existing), React Hook Form + Zod (existing), react-i18next (existing)

---

## Prerequisites

Before starting, add to the **monorepo root `.env`**:
```
RESEND_API_KEY=re_your_key_here
FROM_EMAIL=noreply@yourdomain.com
```
`WEB_URL` already exists in `env.ts` and will be used for the reset link.

---

## Task 1: DB Schema — Add `password_reset_tokens` Table

**Files:**
- Modify: `apps/api/src/db/schema.ts`

**Step 1: Add the table definition**

At the end of `apps/api/src/db/schema.ts`, add:

```typescript
// Password Reset Tokens
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(), // SHA-256 hex = 64 chars
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_prt_user').on(t.userId)],
);
```

**Step 2: Generate and apply migration**

```bash
cd /path/to/repo && pnpm db:generate && pnpm db:migrate
```
Expected: new migration file created, applied without errors.

**Step 3: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat: add password_reset_tokens table"
```

---

## Task 2: Shared — Add Validation Schemas and Types

**Files:**
- Modify: `packages/shared/src/validation/auth.schema.ts`

**Step 1: Add schemas and types**

Append to `packages/shared/src/validation/auth.schema.ts`:

```typescript
export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

Note: `packages/shared/src/index.ts` already uses `export * from './validation/auth.schema.js'` — no changes needed there.

**Step 2: Verify build**

```bash
cd packages/shared && pnpm build
```
Expected: builds without TypeScript errors.

**Step 3: Commit**

```bash
git add packages/shared/src/validation/auth.schema.ts
git commit -m "feat: add forgotPassword and resetPassword schemas to shared"
```

---

## Task 3: Backend — Update Config

**Files:**
- Modify: `apps/api/src/config/env.ts`

**Step 1: Add new env variables**

In `apps/api/src/config/env.ts`, add to the `envSchema` object (after `NODE_ENV`):

```typescript
  RESEND_API_KEY: z.string().min(1),
  FROM_EMAIL: z.string().email(),
```

The complete updated `envSchema`:
```typescript
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  API_PORT: z.coerce.number().default(3001),
  WEB_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:3001'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  MICROSOFT_CLIENT_ID: z.string().default(''),
  MICROSOFT_CLIENT_SECRET: z.string().default(''),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  RESEND_API_KEY: z.string().min(1),
  FROM_EMAIL: z.string().email(),
});
```

**Step 2: Commit**

```bash
git add apps/api/src/config/env.ts
git commit -m "feat: add RESEND_API_KEY and FROM_EMAIL to env config"
```

---

## Task 4: Backend — Email Service

**Files:**
- Create: `apps/api/src/services/email.service.ts`

**Step 1: Install Resend SDK**

```bash
cd apps/api && pnpm add resend
```

**Step 2: Create the email service**

Create `apps/api/src/services/email.service.ts`:

```typescript
import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = new Resend(env.RESEND_API_KEY);

const SUBJECTS: Record<string, string> = {
  de: 'Passwort zurücksetzen',
  fr: 'Réinitialiser votre mot de passe',
  it: 'Reimposta la tua password',
  nl: 'Wachtwoord opnieuw instellen',
  en: 'Reset your password',
};

const BODY_INTRO: Record<string, (name: string) => string> = {
  de: (name) => `Hallo ${name},<br><br>du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt.`,
  fr: (name) => `Bonjour ${name},<br><br>Vous avez demandé la réinitialisation de votre mot de passe.`,
  it: (name) => `Ciao ${name},<br><br>Hai richiesto di reimpostare la tua password.`,
  nl: (name) => `Hallo ${name},<br><br>Je hebt een verzoek ingediend om je wachtwoord opnieuw in te stellen.`,
  en: (name) => `Hi ${name},<br><br>You requested a password reset.`,
};

const BUTTON_TEXT: Record<string, string> = {
  de: 'Passwort zurücksetzen',
  fr: 'Réinitialiser le mot de passe',
  it: 'Reimposta la password',
  nl: 'Wachtwoord opnieuw instellen',
  en: 'Reset password',
};

const EXPIRY_NOTE: Record<string, string> = {
  de: 'Dieser Link ist 1 Stunde gültig. Falls du kein Reset angefordert hast, kannst du diese E-Mail ignorieren.',
  fr: 'Ce lien expire dans 1 heure. Si vous n\'avez pas demandé cette réinitialisation, ignorez cet email.',
  it: 'Questo link scade tra 1 ora. Se non hai richiesto il reset, ignora questa email.',
  nl: 'Deze link is 1 uur geldig. Als je geen reset hebt aangevraagd, kun je deze e-mail negeren.',
  en: 'This link expires in 1 hour. If you didn\'t request a password reset, you can safely ignore this email.',
};

export async function sendPasswordResetEmail(
  to: string,
  displayName: string,
  resetLink: string,
  language: string,
): Promise<void> {
  const lang = SUBJECTS[language] ? language : 'en';
  const subject = SUBJECTS[lang];
  const intro = BODY_INTRO[lang](displayName);
  const buttonText = BUTTON_TEXT[lang];
  const expiryNote = EXPIRY_NOTE[lang];

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <p>${intro}</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}"
           style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px;
                  text-decoration: none; font-weight: 600; display: inline-block;">
          ${buttonText}
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        ${expiryNote}
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">
        ${resetLink}
      </p>
    </div>
  `;

  await resend.emails.send({
    from: env.FROM_EMAIL,
    to,
    subject,
    html,
  });
}
```

**Step 3: Commit**

```bash
git add apps/api/src/services/email.service.ts apps/api/package.json apps/api/pnpm-lock.yaml
git commit -m "feat: add email service with Resend for password reset emails"
```

---

## Task 5: Backend — Auth Service Functions (TDD)

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/modules/auth/auth.service.test.ts`

### Step 1: Update the test file mock setup

In `apps/api/src/modules/auth/auth.service.test.ts`, update the existing `vi.mock('../../db/index.js')` block to add `passwordResetTokens` query and `delete` to the db mock:

```typescript
vi.mock('../../db/index.js', async () => {
  return {
    db: {
      query: {
        users: { findFirst: vi.fn() },
        refreshTokens: { findMany: vi.fn() },
        passwordResetTokens: { findFirst: vi.fn() },  // ADD
      },
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),  // ADD
    },
    schema: await import('../../db/schema.js'),
  };
});
```

Add a mock for the email service right after the db mock:

```typescript
vi.mock('../../services/email.service.js', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));
```

Update the `MockedDb` type:
```typescript
type MockedDb = {
  query: {
    users: { findFirst: ReturnType<typeof vi.fn> };
    refreshTokens: { findMany: ReturnType<typeof vi.fn> };
    passwordResetTokens: { findFirst: ReturnType<typeof vi.fn> };  // ADD
  };
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;  // ADD
};
```

Update the imports at the top to include the new functions (add after the existing import):
```typescript
import { requestPasswordReset, resetPassword } from './auth.service.js';
```
(Add these to the existing import line.)

Update `beforeEach` to also set up the `delete` mock:
```typescript
beforeEach(() => {
  vi.clearAllMocks();

  dbMock.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });

  // ADD: default delete chain: delete(table).where() → resolves
  dbMock.delete.mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  });
});
```

### Step 2: Write tests for `requestPasswordReset`

Append this describe block to `auth.service.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// requestPasswordReset
// ---------------------------------------------------------------------------

describe('requestPasswordReset', () => {
  it('does nothing (no error) when email is not found', async () => {
    dbMock.query.users.findFirst.mockResolvedValue(null);

    await expect(requestPasswordReset('unknown@example.com')).resolves.toBeUndefined();
  });

  it('deletes old tokens and inserts new one when user exists', async () => {
    dbMock.query.users.findFirst.mockResolvedValue({ ...mockUser, language: 'en' });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    await requestPasswordReset('test@example.com');

    // delete was called for old tokens
    expect(dbMock.delete).toHaveBeenCalled();
    // insert was called for the new token
    expect(dbMock.insert).toHaveBeenCalled();
  });

  it('stores a SHA-256 hash — not the raw token', async () => {
    dbMock.query.users.findFirst.mockResolvedValue({ ...mockUser, language: 'en' });
    const insertValues = vi.fn().mockResolvedValue(undefined);
    dbMock.insert.mockReturnValue({ values: insertValues });

    await requestPasswordReset('test@example.com');

    const inserted = insertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.tokenHash).toBeDefined();
    // SHA-256 hex digest is always 64 chars
    expect(String(inserted.tokenHash)).toHaveLength(64);
  });
});
```

### Step 3: Write tests for `resetPassword`

```typescript
// ---------------------------------------------------------------------------
// resetPassword
// ---------------------------------------------------------------------------

describe('resetPassword', () => {
  it('throws 400 when token is not found', async () => {
    dbMock.query.passwordResetTokens.findFirst.mockResolvedValue(null);

    await expect(resetPassword('bad-token', 'newpassword123')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid or expired reset token',
    });
  });

  it('throws 400 when token is already used', async () => {
    dbMock.query.passwordResetTokens.findFirst.mockResolvedValue({
      id: 'prt-1',
      userId: 'user-123',
      tokenHash: 'abc',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),  // already used
    });

    await expect(resetPassword('some-token', 'newpassword123')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid or expired reset token',
    });
  });

  it('throws 400 when token is expired', async () => {
    dbMock.query.passwordResetTokens.findFirst.mockResolvedValue({
      id: 'prt-1',
      userId: 'user-123',
      tokenHash: 'abc',
      expiresAt: new Date(Date.now() - 60_000),  // expired
      usedAt: null,
    });

    await expect(resetPassword('some-token', 'newpassword123')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid or expired reset token',
    });
  });

  it('updates password, marks token used, revokes refresh tokens on success', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    dbMock.query.passwordResetTokens.findFirst.mockResolvedValue({
      id: 'prt-1',
      userId: 'user-123',
      tokenHash,
      expiresAt: new Date(Date.now() + 3_600_000),
      usedAt: null,
    });

    await resetPassword(rawToken, 'newpassword123');

    // update was called at least twice: password + mark used + revoke tokens
    expect(dbMock.update).toHaveBeenCalledTimes(3);
  });
});
```

### Step 4: Run tests to verify they fail

```bash
cd apps/api && pnpm vitest run src/modules/auth/auth.service.test.ts
```
Expected: tests for `requestPasswordReset` and `resetPassword` fail because functions don't exist yet.

### Step 5: Implement the functions in `auth.service.ts`

**a) Update imports** at the top of `apps/api/src/modules/auth/auth.service.ts`:

```typescript
import { eq, isNull, and } from 'drizzle-orm';  // add 'and'
import { sendPasswordResetEmail } from '../../services/email.service.js';  // ADD
import type { RegisterInput, LoginInput } from '@trello-clone/shared';
```

**b) Add constants** after the existing constants:

```typescript
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
```

**c) Add the two new exported functions** at the end of `auth.service.ts`:

```typescript
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  // Return silently if no user — prevents email enumeration
  if (!user) return;

  // Delete any existing tokens for this user
  await db.delete(schema.passwordResetTokens)
    .where(eq(schema.passwordResetTokens.userId, user.id));

  // Generate secure random token and hash it
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  await db.insert(schema.passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const resetLink = `${env.WEB_URL}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, user.displayName, resetLink, user.language);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const resetToken = await db.query.passwordResetTokens.findFirst({
    where: eq(schema.passwordResetTokens.tokenHash, tokenHash),
  });

  if (!resetToken || resetToken.usedAt !== null || resetToken.expiresAt < new Date()) {
    throw new AppError(400, 'Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Update user password
  await db.update(schema.users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(schema.users.id, resetToken.userId));

  // Mark token as used
  await db.update(schema.passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(schema.passwordResetTokens.id, resetToken.id));

  // Revoke all active refresh tokens for this user
  await db.update(schema.refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(schema.refreshTokens.userId, resetToken.userId),
      isNull(schema.refreshTokens.revokedAt),
    ));
}
```

### Step 6: Run tests to verify they pass

```bash
cd apps/api && pnpm vitest run src/modules/auth/auth.service.test.ts
```
Expected: ALL tests pass, including the new ones.

### Step 7: Commit

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/modules/auth/auth.service.test.ts
git commit -m "feat: add requestPasswordReset and resetPassword service functions"
```

---

## Task 6: Backend — Controller and Routes

**Files:**
- Modify: `apps/api/src/modules/auth/auth.controller.ts`
- Modify: `apps/api/src/modules/auth/auth.routes.ts`

### Step 1: Add handlers to `auth.controller.ts`

Append to `apps/api/src/modules/auth/auth.controller.ts`:

```typescript
export async function forgotPasswordHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await authService.requestPasswordReset(req.body.email);
    res.json({ message: 'If an account exists for this email, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
}

export async function resetPasswordHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await authService.resetPassword(req.body.token, req.body.password);
    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    next(err);
  }
}
```

### Step 2: Add routes to `auth.routes.ts`

In `apps/api/src/modules/auth/auth.routes.ts`, update the import from `@trello-clone/shared`:
```typescript
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '@trello-clone/shared';
```

Add two routes before the `export`:
```typescript
router.post('/forgot-password', validate(forgotPasswordSchema), ctrl.forgotPasswordHandler);
router.post('/reset-password', validate(resetPasswordSchema), ctrl.resetPasswordHandler);
```

### Step 3: Verify API starts and routes exist

```bash
cd apps/api && pnpm dev
```
Then in another terminal:
```bash
curl -X POST http://localhost:3001/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```
Expected: `{"message":"If an account exists for this email, a reset link has been sent."}`

### Step 4: Commit

```bash
git add apps/api/src/modules/auth/auth.controller.ts apps/api/src/modules/auth/auth.routes.ts
git commit -m "feat: add forgot-password and reset-password API endpoints"
```

---

## Task 7: Frontend — API Client Functions

**Files:**
- Modify: `apps/web/src/api/auth.api.ts`

### Step 1: Add functions

Append to `apps/web/src/api/auth.api.ts`:

```typescript
export async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post('/auth/reset-password', { token, password });
}
```

### Step 2: Commit

```bash
git add apps/web/src/api/auth.api.ts
git commit -m "feat: add requestPasswordReset and resetPassword API client functions"
```

---

## Task 8: i18n — Add Translations in All 5 Languages

**Files:**
- Modify: `apps/web/src/locales/en/translation.json`
- Modify: `apps/web/src/locales/de/translation.json`
- Modify: `apps/web/src/locales/fr/translation.json`
- Modify: `apps/web/src/locales/it/translation.json`
- Modify: `apps/web/src/locales/nl/translation.json`

### Step 1: Add keys to the `"auth"` object in each file

In each file, add these keys inside the existing `"auth": { ... }` object.

**English** (`en/translation.json`):
```json
"forgotPassword": "Forgot password?",
"forgotPasswordTitle": "Reset password",
"forgotPasswordDescription": "Enter your email and we'll send you a reset link.",
"sendResetLink": "Send reset link",
"sendingResetLink": "Sending...",
"resetEmailSent": "Email sent",
"resetEmailSentDescription": "If an account with that email exists, you will receive a reset link shortly.",
"resetPasswordTitle": "Choose a new password",
"setNewPassword": "Set new password",
"settingNewPassword": "Saving...",
"passwordResetSuccess": "Password changed. Please sign in.",
"invalidOrExpiredToken": "This link is invalid or has expired.",
"requestNewLink": "Request a new link",
"backToLogin": "Back to sign in",
"forgotPasswordError": "Failed to send reset email. Please try again."
```

**German** (`de/translation.json`):
```json
"forgotPassword": "Passwort vergessen?",
"forgotPasswordTitle": "Passwort zurücksetzen",
"forgotPasswordDescription": "Gib deine E-Mail-Adresse ein und wir senden dir einen Reset-Link.",
"sendResetLink": "Reset-Link senden",
"sendingResetLink": "Wird gesendet...",
"resetEmailSent": "E-Mail gesendet",
"resetEmailSentDescription": "Falls ein Konto mit dieser E-Mail-Adresse existiert, erhältst du in Kürze einen Reset-Link.",
"resetPasswordTitle": "Neues Passwort wählen",
"setNewPassword": "Passwort setzen",
"settingNewPassword": "Wird gespeichert...",
"passwordResetSuccess": "Passwort geändert. Bitte einloggen.",
"invalidOrExpiredToken": "Dieser Link ist ungültig oder abgelaufen.",
"requestNewLink": "Neuen Link anfordern",
"backToLogin": "Zurück zum Login",
"forgotPasswordError": "Reset-Link konnte nicht gesendet werden. Bitte erneut versuchen."
```

**French** (`fr/translation.json`):
```json
"forgotPassword": "Mot de passe oublié ?",
"forgotPasswordTitle": "Réinitialiser le mot de passe",
"forgotPasswordDescription": "Saisissez votre email et nous vous enverrons un lien de réinitialisation.",
"sendResetLink": "Envoyer le lien",
"sendingResetLink": "Envoi en cours...",
"resetEmailSent": "Email envoyé",
"resetEmailSentDescription": "Si un compte avec cet email existe, vous recevrez un lien de réinitialisation sous peu.",
"resetPasswordTitle": "Choisir un nouveau mot de passe",
"setNewPassword": "Définir le mot de passe",
"settingNewPassword": "Enregistrement...",
"passwordResetSuccess": "Mot de passe modifié. Veuillez vous connecter.",
"invalidOrExpiredToken": "Ce lien est invalide ou a expiré.",
"requestNewLink": "Demander un nouveau lien",
"backToLogin": "Retour à la connexion",
"forgotPasswordError": "Impossible d'envoyer le lien. Veuillez réessayer."
```

**Italian** (`it/translation.json`):
```json
"forgotPassword": "Password dimenticata?",
"forgotPasswordTitle": "Reimposta la password",
"forgotPasswordDescription": "Inserisci la tua email e ti invieremo un link di reimpostazione.",
"sendResetLink": "Invia link di reset",
"sendingResetLink": "Invio in corso...",
"resetEmailSent": "Email inviata",
"resetEmailSentDescription": "Se esiste un account con questa email, riceverai presto un link di reimpostazione.",
"resetPasswordTitle": "Scegli una nuova password",
"setNewPassword": "Imposta password",
"settingNewPassword": "Salvataggio...",
"passwordResetSuccess": "Password modificata. Accedi ora.",
"invalidOrExpiredToken": "Questo link non è valido o è scaduto.",
"requestNewLink": "Richiedi un nuovo link",
"backToLogin": "Torna al login",
"forgotPasswordError": "Impossibile inviare il link. Riprova."
```

**Dutch** (`nl/translation.json`):
```json
"forgotPassword": "Wachtwoord vergeten?",
"forgotPasswordTitle": "Wachtwoord opnieuw instellen",
"forgotPasswordDescription": "Voer je e-mailadres in en we sturen je een resetlink.",
"sendResetLink": "Resetlink verzenden",
"sendingResetLink": "Verzenden...",
"resetEmailSent": "E-mail verzonden",
"resetEmailSentDescription": "Als er een account bestaat voor dit e-mailadres, ontvang je binnenkort een resetlink.",
"resetPasswordTitle": "Kies een nieuw wachtwoord",
"setNewPassword": "Wachtwoord instellen",
"settingNewPassword": "Opslaan...",
"passwordResetSuccess": "Wachtwoord gewijzigd. Log in.",
"invalidOrExpiredToken": "Deze link is ongeldig of verlopen.",
"requestNewLink": "Nieuw link aanvragen",
"backToLogin": "Terug naar inloggen",
"forgotPasswordError": "Resetlink kon niet worden verzonden. Probeer het opnieuw."
```

### Step 2: Commit

```bash
git add apps/web/src/locales/
git commit -m "feat: add i18n keys for password reset flow in all 5 languages"
```

---

## Task 9: Frontend — ForgotPasswordPage

**Files:**
- Create: `apps/web/src/features/auth/ForgotPasswordPage.tsx`

### Step 1: Create the component

```typescript
import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { requestPasswordReset } from '../../api/auth.api.js';
import { AuthLayout } from '../../components/layout/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';

const emailSchema = z.object({ email: z.string().email() });
type EmailForm = z.infer<typeof emailSchema>;

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });

  const onSubmit = async (data: EmailForm) => {
    try {
      setError('');
      await requestPasswordReset(data.email);
      setSubmitted(true);
    } catch {
      setError(t('auth.forgotPasswordError'));
    }
  };

  if (submitted) {
    return (
      <AuthLayout>
        <h2 className="text-xl font-semibold dark:text-gray-100 mb-4">{t('auth.resetEmailSent')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{t('auth.resetEmailSentDescription')}</p>
        <Link to="/login" className="text-blue-600 hover:underline text-sm">
          {t('auth.backToLogin')}
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2 className="text-xl font-semibold dark:text-gray-100 mb-2">{t('auth.forgotPasswordTitle')}</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{t('auth.forgotPasswordDescription')}</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label={t('auth.email')} type="email" {...register('email')} error={errors.email?.message} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t('auth.sendingResetLink') : t('auth.sendResetLink')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        <Link to="/login" className="text-blue-600 hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </AuthLayout>
  );
}
```

### Step 2: Commit

```bash
git add apps/web/src/features/auth/ForgotPasswordPage.tsx
git commit -m "feat: add ForgotPasswordPage component"
```

---

## Task 10: Frontend — ResetPasswordPage

**Files:**
- Create: `apps/web/src/features/auth/ResetPasswordPage.tsx`

### Step 1: Create the component

```typescript
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { resetPassword } from '../../api/auth.api.js';
import { AuthLayout } from '../../components/layout/AuthLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';

const newPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
type NewPasswordForm = z.infer<typeof newPasswordSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordForm>({ resolver: zodResolver(newPasswordSchema) });

  const onSubmit = async (data: NewPasswordForm) => {
    try {
      setError('');
      await resetPassword(token, data.password);
      navigate('/login', { state: { passwordReset: true } });
    } catch {
      setError(t('auth.invalidOrExpiredToken'));
    }
  };

  if (!token) {
    return (
      <AuthLayout>
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{t('auth.invalidOrExpiredToken')}</p>
        <Link to="/forgot-password" className="text-blue-600 hover:underline text-sm">
          {t('auth.requestNewLink')}
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2 className="text-xl font-semibold dark:text-gray-100 mb-6">{t('auth.resetPasswordTitle')}</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}{' '}
          <Link to="/forgot-password" className="underline">
            {t('auth.requestNewLink')}
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t('auth.password')}
          type="password"
          {...register('password')}
          error={errors.password?.message}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t('auth.settingNewPassword') : t('auth.setNewPassword')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        <Link to="/login" className="text-blue-600 hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </AuthLayout>
  );
}
```

### Step 2: Commit

```bash
git add apps/web/src/features/auth/ResetPasswordPage.tsx
git commit -m "feat: add ResetPasswordPage component"
```

---

## Task 11: Frontend — Update LoginPage and App Routing

**Files:**
- Modify: `apps/web/src/features/auth/LoginPage.tsx`
- Modify: `apps/web/src/App.tsx`

### Step 1: Add "Forgot password?" link to `LoginPage.tsx`

Add `useLocation` to the import:
```typescript
import { useNavigate, Link, useLocation } from 'react-router';
```

Add state handling inside the `LoginPage` function, right after `const { t } = useTranslation();`:
```typescript
const location = useLocation();
const passwordResetSuccess = (location.state as { passwordReset?: boolean } | null)?.passwordReset;
```

Add success banner in the JSX, right before the `{error && ...}` block:
```tsx
{passwordResetSuccess && (
  <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm">
    {t('auth.passwordResetSuccess')}
  </div>
)}
```

Add "Forgot password?" link between the `<Input password>` and the submit `<Button>`. Replace the `<Input password ... />` + `<Button>` part of the form with:
```tsx
<Input label={t('auth.password')} type="password" {...register('password')} error={errors.password?.message} />
<div className="flex justify-end">
  <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline">
    {t('auth.forgotPassword')}
  </Link>
</div>
<Button type="submit" className="w-full" disabled={isSubmitting}>
  {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
</Button>
```

### Step 2: Add routes to `App.tsx`

Add imports after the existing auth page imports:
```typescript
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage.js';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage.js';
```

Add routes inside `<Routes>`, after the existing `/auth/callback` route:
```tsx
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password" element={<ResetPasswordPage />} />
```

### Step 3: Commit

```bash
git add apps/web/src/features/auth/LoginPage.tsx apps/web/src/App.tsx
git commit -m "feat: add forgot-password route and link in LoginPage"
```

---

## Task 12: Full Build and Verification

### Step 1: Run full test suite

```bash
cd /path/to/repo && pnpm test
```
Expected: all tests pass.

### Step 2: Run build

```bash
pnpm build
```
Expected: no TypeScript errors across all packages.

### Step 3: Run lint

```bash
pnpm lint
```
Expected: no lint errors.

### Step 4: Manual E2E test

Start the dev server:
```bash
pnpm dev
```

Test flow:
1. Navigate to `http://localhost:5173/login`
2. Click "Forgot password?" — navigates to `/forgot-password`
3. Enter a registered email → success message appears (same message regardless of email existence)
4. Check Resend dashboard for the email, click the reset link
5. URL is `/reset-password?token=...` — shows "Choose a new password" form
6. Enter new password (≥8 chars) → redirects to `/login` with success banner
7. Sign in with new password → works
8. Click the reset link again → shows "invalid or expired" error with "Request a new link"
9. Test with non-existent email → same success message (no enumeration)
10. Test `/reset-password` with no token in URL → shows "invalid or expired" immediately

### Step 5: Final commit

```bash
git add docs/plans/2026-03-02-password-reset.md
git commit -m "docs: add password reset implementation plan"
```
