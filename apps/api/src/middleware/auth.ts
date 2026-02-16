import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './error.js';

export interface AuthRequest extends Request {
  userId?: string;
  /** Socket.IO socket ID of the requesting client, used to exclude from broadcasts */
  socketId?: string;
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
