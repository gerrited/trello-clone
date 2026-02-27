import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

vi.mock('../config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-min-10-chars',
    JWT_REFRESH_SECRET: 'test-refresh-secret-min-10-chars',
  },
}));

import { requireAuth } from './auth.js';
import type { AuthRequest } from './auth.js';

const TEST_SECRET = 'test-jwt-secret-min-10-chars';

function makeReq(headers: Record<string, string> = {}): AuthRequest {
  return { headers } as unknown as AuthRequest;
}

describe('requireAuth middleware', () => {
  const next = vi.fn() as unknown as NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws 401 when Authorization header is missing', () => {
    const req = makeReq();
    expect(() => requireAuth(req, {} as Response, next)).toThrow('Missing or invalid authorization header');
  });

  it('throws 401 when Authorization header uses Basic scheme instead of Bearer', () => {
    const req = makeReq({ authorization: 'Basic dXNlcjpwYXNz' });
    expect(() => requireAuth(req, {} as Response, next)).toThrow('Missing or invalid authorization header');
  });

  it('throws 401 when Bearer token is malformed', () => {
    const req = makeReq({ authorization: 'Bearer not.a.valid.jwt' });
    expect(() => requireAuth(req, {} as Response, next)).toThrow('Invalid or expired token');
  });

  it('throws 401 when token is signed with wrong secret', () => {
    const token = jwt.sign({ sub: 'user-1' }, 'wrong-secret', { expiresIn: '15m' });
    const req = makeReq({ authorization: `Bearer ${token}` });
    expect(() => requireAuth(req, {} as Response, next)).toThrow('Invalid or expired token');
  });

  it('throws 401 when token is expired', () => {
    const token = jwt.sign({ sub: 'user-1' }, TEST_SECRET, { expiresIn: -1 });
    const req = makeReq({ authorization: `Bearer ${token}` });
    expect(() => requireAuth(req, {} as Response, next)).toThrow('Invalid or expired token');
  });

  it('calls next() and sets req.userId for a valid token', () => {
    const token = jwt.sign({ sub: 'user-abc' }, TEST_SECRET, { expiresIn: '15m' });
    const req = makeReq({ authorization: `Bearer ${token}` });
    requireAuth(req, {} as Response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe('user-abc');
  });

  it('sets req.socketId from x-socket-id header when token is valid', () => {
    const token = jwt.sign({ sub: 'user-abc' }, TEST_SECRET, { expiresIn: '15m' });
    const req = makeReq({ authorization: `Bearer ${token}`, 'x-socket-id': 'socket-xyz' });
    requireAuth(req, {} as Response, next);
    expect(req.socketId).toBe('socket-xyz');
  });

  it('leaves req.socketId undefined when x-socket-id header is absent', () => {
    const token = jwt.sign({ sub: 'user-abc' }, TEST_SECRET, { expiresIn: '15m' });
    const req = makeReq({ authorization: `Bearer ${token}` });
    requireAuth(req, {} as Response, next);
    expect(req.socketId).toBeUndefined();
  });
});
