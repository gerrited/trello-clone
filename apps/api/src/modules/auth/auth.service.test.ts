import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

vi.mock('../../config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-min-10-chars',
    JWT_REFRESH_SECRET: 'test-refresh-secret-min-10-chars',
    DATABASE_URL: 'postgresql://localhost:5432/test_db',
  },
}));

vi.mock('../../db/index.js', async () => {
  return {
    db: {
      query: {
        users: { findFirst: vi.fn() },
        refreshTokens: { findMany: vi.fn() },
      },
      insert: vi.fn(),
      update: vi.fn(),
    },
    schema: await import('../../db/schema.js'),
  };
});

import { db } from '../../db/index.js';
import { register, login, refreshAccessToken, revokeRefreshToken, getMe } from './auth.service.js';

const dbMock = db as any;

/** Create a promise-like object that is also awaitable and supports .returning() */
function makeInsertValues(returningData: unknown[]) {
  const returning = vi.fn().mockResolvedValue(returningData);
  const result = {
    returning,
    then: (resolve: (v: void) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(undefined).then(resolve, reject),
    catch: (onRejected: (e: unknown) => unknown) => Promise.resolve(undefined).catch(onRejected),
  };
  return vi.fn().mockReturnValue(result);
}

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();

  // Default update chain: update(table).set({}).where() → resolves
  dbMock.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });
});

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------

describe('register', () => {
  it('throws 409 when email is already registered', async () => {
    dbMock.query.users.findFirst.mockResolvedValue(mockUser);

    await expect(
      register({ email: 'test@example.com', password: 'password', displayName: 'Test' }),
    ).rejects.toMatchObject({ statusCode: 409, message: 'Email already registered' });
  });

  it('creates the user and returns tokens on success', async () => {
    dbMock.query.users.findFirst.mockResolvedValue(null);

    const userInsertValues = makeInsertValues([mockUser]);
    const refreshInsertValues = vi.fn().mockResolvedValue(undefined);
    dbMock.insert
      .mockReturnValueOnce({ values: userInsertValues })
      .mockReturnValueOnce({ values: refreshInsertValues });

    const result = await register({ email: 'test@example.com', password: 'secret', displayName: 'Test User' });

    expect(result.user.email).toBe('test@example.com');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it('stores a bcrypt hash — not the plaintext password', async () => {
    dbMock.query.users.findFirst.mockResolvedValue(null);

    const userInsertValues = makeInsertValues([mockUser]);
    const refreshInsertValues = vi.fn().mockResolvedValue(undefined);
    dbMock.insert
      .mockReturnValueOnce({ values: userInsertValues })
      .mockReturnValueOnce({ values: refreshInsertValues });

    await register({ email: 'test@example.com', password: 'plaintext', displayName: 'Test' });

    const insertedData = userInsertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedData.passwordHash).toBeDefined();
    expect(insertedData.passwordHash).not.toBe('plaintext');
    // Verify it's a valid bcrypt hash
    const isValidHash = await bcrypt.compare('plaintext', insertedData.passwordHash as string);
    expect(isValidHash).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

describe('login', () => {
  it('throws 401 when user is not found', async () => {
    dbMock.query.users.findFirst.mockResolvedValue(null);

    await expect(login({ email: 'unknown@example.com', password: 'any' })).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
  });

  it('throws 401 when user has no password (OAuth-only account)', async () => {
    dbMock.query.users.findFirst.mockResolvedValue({ ...mockUser, passwordHash: null });

    await expect(login({ email: 'test@example.com', password: 'any' })).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
  });

  it('throws 401 when password does not match', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 1);
    dbMock.query.users.findFirst.mockResolvedValue({ ...mockUser, passwordHash });

    await expect(login({ email: 'test@example.com', password: 'wrong-password' })).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password',
    });
  });

  it('returns user and tokens on correct credentials', async () => {
    const password = 'correct-password';
    const passwordHash = await bcrypt.hash(password, 1);
    dbMock.query.users.findFirst.mockResolvedValue({ ...mockUser, passwordHash });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const result = await login({ email: 'test@example.com', password });

    expect(result.user.email).toBe('test@example.com');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// refreshAccessToken
// ---------------------------------------------------------------------------

describe('refreshAccessToken', () => {
  it('throws 401 when no tokens exist in the database', async () => {
    dbMock.query.refreshTokens.findMany.mockResolvedValue([]);

    await expect(refreshAccessToken('any-token')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid or expired refresh token',
    });
  });

  it('throws 401 when the token does not match any stored hash', async () => {
    const differentToken = crypto.randomBytes(40).toString('hex');
    const hash = await bcrypt.hash(differentToken, 1);
    dbMock.query.refreshTokens.findMany.mockResolvedValue([
      { id: 'rt-1', userId: 'user-1', tokenHash: hash, expiresAt: new Date(Date.now() + 1000), revokedAt: null },
    ]);

    await expect(refreshAccessToken('non-matching-token')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid or expired refresh token',
    });
  });

  it('throws 401 when the matching token has expired', async () => {
    const tokenValue = crypto.randomBytes(40).toString('hex');
    const tokenHash = await bcrypt.hash(tokenValue, 1);
    dbMock.query.refreshTokens.findMany.mockResolvedValue([
      {
        id: 'rt-1',
        userId: 'user-1',
        tokenHash,
        expiresAt: new Date(Date.now() - 1000), // expired
        revokedAt: null,
      },
    ]);

    await expect(refreshAccessToken(tokenValue)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid or expired refresh token',
    });
  });

  it('returns new tokens and rotates the refresh token on success', async () => {
    const tokenValue = crypto.randomBytes(40).toString('hex');
    const tokenHash = await bcrypt.hash(tokenValue, 1);
    dbMock.query.refreshTokens.findMany.mockResolvedValue([
      {
        id: 'rt-1',
        userId: 'user-1',
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
      },
    ]);
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const result = await refreshAccessToken(tokenValue);

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    // Old token should be revoked
    const updateSetWhere = dbMock.update.mock.results[0]?.value?.set?.mock?.results[0]?.value?.where;
    expect(updateSetWhere).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// revokeRefreshToken
// ---------------------------------------------------------------------------

describe('revokeRefreshToken', () => {
  it('does nothing when token is not found (no error thrown)', async () => {
    dbMock.query.refreshTokens.findMany.mockResolvedValue([]);

    await expect(revokeRefreshToken('nonexistent-token')).resolves.toBeUndefined();
  });

  it('revokes the matching refresh token', async () => {
    const tokenValue = crypto.randomBytes(40).toString('hex');
    const tokenHash = await bcrypt.hash(tokenValue, 1);
    dbMock.query.refreshTokens.findMany.mockResolvedValue([
      { id: 'rt-1', userId: 'user-1', tokenHash, expiresAt: new Date(Date.now() + 1000), revokedAt: null },
    ]);

    await revokeRefreshToken(tokenValue);

    const updateSetWhere = dbMock.update.mock.results[0]?.value?.set?.mock?.results[0]?.value?.where;
    expect(updateSetWhere).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getMe
// ---------------------------------------------------------------------------

describe('getMe', () => {
  it('throws 404 when user does not exist', async () => {
    dbMock.query.users.findFirst.mockResolvedValue(null);

    await expect(getMe('nonexistent-id')).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    });
  });

  it('returns user data when found', async () => {
    dbMock.query.users.findFirst.mockResolvedValue(mockUser);

    const result = await getMe('user-123');

    expect(result.id).toBe('user-123');
    expect(result.email).toBe('test@example.com');
  });
});
