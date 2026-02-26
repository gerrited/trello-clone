import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './error.js';

export interface AuthRequest extends Request {
  userId?: string;
  /** Socket.IO socket ID of the requesting client, used to exclude from broadcasts */
  socketId?: string;
  /** Share token for unauthenticated shared-board access */
  shareToken?: string;
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
    req.socketId = req.headers['x-socket-id'] as string | undefined;
    next();
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }
}

/**
 * Middleware that optionally extracts a Bearer JWT (sets req.userId) and/or
 * an X-Share-Token header (sets req.shareToken). Does NOT throw if neither is present.
 * Both can be set simultaneously for authenticated users visiting a share link.
 */
export function optionalShareAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const shareToken = req.headers['x-share-token'] as string | undefined;
  const authHeader = req.headers.authorization;

  if (shareToken) {
    req.shareToken = shareToken;
  }

  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), env.JWT_SECRET) as { sub: string };
      req.userId = payload.sub;
      req.socketId = req.headers['x-socket-id'] as string | undefined;
    } catch {
      // ignore invalid tokens in optional mode
    }
  }

  next();
}
