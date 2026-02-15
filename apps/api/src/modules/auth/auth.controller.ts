import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import * as authService from './auth.service.js';

export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const COOKIE_OPTIONS = {
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
