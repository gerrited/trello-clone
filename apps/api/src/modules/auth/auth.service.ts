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
    where: isNull(schema.refreshTokens.revokedAt),
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
    where: isNull(schema.refreshTokens.revokedAt),
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
    const updateField = provider === 'google' ? 'googleId' : 'microsoftId';
    await db
      .update(schema.users)
      .set({ [updateField]: profile.id })
      .where(eq(schema.users.id, user.id));

    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);
    return { user, accessToken, refreshToken };
  }

  // Create new user
  const insertField = provider === 'google' ? 'googleId' : 'microsoftId';
  const [newUser] = await db
    .insert(schema.users)
    .values({
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl ?? null,
      [insertField]: profile.id,
    })
    .returning();

  const accessToken = generateAccessToken(newUser.id);
  const refreshToken = await generateRefreshToken(newUser.id);
  return { user: newUser, accessToken, refreshToken };
}
