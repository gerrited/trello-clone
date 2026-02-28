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
    .set({ displayName: input.displayName, email: input.email, updatedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning({
      id: schema.users.id,
      email: schema.users.email,
      displayName: schema.users.displayName,
      avatarUrl: schema.users.avatarUrl,
      passwordHash: schema.users.passwordHash,
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
