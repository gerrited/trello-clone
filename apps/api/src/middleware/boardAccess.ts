import { eq, and } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { AppError } from './error.js';
import type { BoardPermission } from '@trello-clone/shared';

const PERMISSION_LEVEL: Record<BoardPermission, number> = {
  read: 0,
  comment: 1,
  edit: 2,
};

export interface BoardAccessResult {
  board: typeof schema.boards.$inferSelect;
  permission: BoardPermission;
}

/**
 * Check whether `userId` can access `boardId` with at least `minPermission`.
 *
 * Resolution order:
 * 1. Team membership → always 'edit'
 * 2. board_shares row for this user → returns share.permission
 * 3. Neither → throw 403
 */
export async function requireBoardAccess(
  boardId: string,
  userId: string,
  minPermission: BoardPermission = 'read',
): Promise<BoardAccessResult> {
  const board = await db.query.boards.findFirst({
    where: eq(schema.boards.id, boardId),
  });
  if (!board) throw new AppError(404, 'Board not found');

  // 1. Check team membership first (always edit)
  const membership = await db.query.teamMemberships.findFirst({
    where: and(
      eq(schema.teamMemberships.teamId, board.teamId),
      eq(schema.teamMemberships.userId, userId),
    ),
  });

  if (membership) {
    return { board, permission: 'edit' };
  }

  // 2. Check board_shares for this user
  const share = await db.query.boardShares.findFirst({
    where: and(
      eq(schema.boardShares.boardId, boardId),
      eq(schema.boardShares.userId, userId),
    ),
  });

  if (share) {
    // Check expiry
    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new AppError(403, 'Share has expired');
    }

    const effectivePermission = share.permission as BoardPermission;
    if (PERMISSION_LEVEL[effectivePermission] < PERMISSION_LEVEL[minPermission]) {
      throw new AppError(403, `Requires at least '${minPermission}' permission`);
    }
    return { board, permission: effectivePermission };
  }

  // 3. No access
  throw new AppError(403, 'Not a member of this team');
}

/**
 * Resolve access from a share token (for unauthenticated/link-based access).
 */
export async function resolveBoardToken(
  token: string,
  minPermission: BoardPermission = 'read',
): Promise<BoardAccessResult> {
  const share = await db.query.boardShares.findFirst({
    where: eq(schema.boardShares.token, token),
  });

  if (!share) throw new AppError(404, 'Share link not found');
  if (share.expiresAt && share.expiresAt < new Date()) {
    throw new AppError(410, 'Share link has expired');
  }

  const board = await db.query.boards.findFirst({
    where: eq(schema.boards.id, share.boardId),
  });
  if (!board) throw new AppError(404, 'Board not found');

  const effectivePermission = share.permission as BoardPermission;
  if (PERMISSION_LEVEL[effectivePermission] < PERMISSION_LEVEL[minPermission]) {
    throw new AppError(403, `Requires at least '${minPermission}' permission`);
  }

  return { board, permission: effectivePermission };
}
