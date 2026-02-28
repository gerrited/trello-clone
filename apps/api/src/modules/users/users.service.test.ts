import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';

vi.mock('../../config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-min-10-chars',
    DATABASE_URL: 'postgresql://localhost:5432/test_db',
  },
}));

vi.mock('../../db/index.js', async () => ({
  db: {
    query: { users: { findFirst: vi.fn() } },
    update: vi.fn(),
  },
  schema: await import('../../db/schema.js'),
}));

import { db } from '../../db/index.js';
import { updateProfile, changePassword } from './users.service.js';

type MockedDb = {
  query: { users: { findFirst: ReturnType<typeof vi.fn> } };
  update: ReturnType<typeof vi.fn>;
};
const dbMock = db as unknown as MockedDb;

function makeUpdateReturning(returningData: unknown[]) {
  const returning = vi.fn().mockResolvedValue(returningData);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  return vi.fn().mockReturnValue({ set });
}

function makeUpdateChain() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });
  return vi.fn().mockReturnValue({ set });
}

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  passwordHash: 'hashed-password',
  displayName: 'Test User',
  avatarUrl: null,
  googleId: null,
  microsoftId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => vi.clearAllMocks());

describe('updateProfile', () => {
  it('throws 409 when email is taken by another user', async () => {
    dbMock.query.users.findFirst.mockResolvedValue({ ...mockUser, id: 'other-user' });
    dbMock.update = makeUpdateReturning([]);
    await expect(
      updateProfile('user-123', { displayName: 'Test', email: 'taken@example.com' }),
    ).rejects.toThrow('Email already in use');
  });

  it('succeeds and returns user with hasPassword computed', async () => {
    const updated = { ...mockUser, displayName: 'New Name', email: 'new@example.com' };
    dbMock.query.users.findFirst.mockResolvedValue(null);
    dbMock.update = makeUpdateReturning([updated]);
    const result = await updateProfile('user-123', { displayName: 'New Name', email: 'new@example.com' });
    expect(result.displayName).toBe('New Name');
    expect(result.hasPassword).toBe(true);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws 404 when user not found', async () => {
    dbMock.query.users.findFirst.mockResolvedValue(null);
    dbMock.update = makeUpdateReturning([]);
    await expect(
      updateProfile('nonexistent', { displayName: 'Test', email: 'test@example.com' }),
    ).rejects.toThrow('User not found');
  });
});

describe('changePassword', () => {
  it('throws 400 for OAuth users (no passwordHash)', async () => {
    dbMock.query.users.findFirst.mockResolvedValue({ ...mockUser, passwordHash: null });
    await expect(
      changePassword('user-123', { currentPassword: 'any', newPassword: 'newpass123', confirmPassword: 'newpass123' }),
    ).rejects.toThrow('Password change not supported');
  });

  it('throws 400 when current password is wrong', async () => {
    const hash = await bcrypt.hash('correct', 10);
    dbMock.query.users.findFirst.mockResolvedValue({ ...mockUser, passwordHash: hash });
    await expect(
      changePassword('user-123', { currentPassword: 'wrong', newPassword: 'newpass123', confirmPassword: 'newpass123' }),
    ).rejects.toThrow('Current password is incorrect');
  });

  it('updates password successfully', async () => {
    const hash = await bcrypt.hash('correct', 10);
    dbMock.query.users.findFirst.mockResolvedValue({ ...mockUser, passwordHash: hash });
    dbMock.update = makeUpdateChain();
    await expect(
      changePassword('user-123', { currentPassword: 'correct', newPassword: 'newpass123', confirmPassword: 'newpass123' }),
    ).resolves.toBeUndefined();
    expect(dbMock.update).toHaveBeenCalled();
  });
});
