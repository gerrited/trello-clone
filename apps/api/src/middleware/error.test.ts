import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

vi.mock('pino', () => ({
  pino: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

import { AppError, errorHandler } from './error.js';

function makeMockRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json } as unknown as { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

const mockReq = {} as unknown as Request;
const mockNext = vi.fn();

// ---------------------------------------------------------------------------
// AppError class
// ---------------------------------------------------------------------------

describe('AppError', () => {
  it('sets statusCode and message', () => {
    const err = new AppError(404, 'Not found');

    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Not found');
  });

  it('has name "AppError"', () => {
    const err = new AppError(400, 'Bad request');

    expect(err.name).toBe('AppError');
  });

  it('is an instance of Error', () => {
    const err = new AppError(500, 'Server error');

    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// errorHandler middleware
// ---------------------------------------------------------------------------

describe('errorHandler', () => {
  it('responds with statusCode and message for AppError', () => {
    const res = makeMockRes();
    const err = new AppError(403, 'Forbidden');

    errorHandler(err, mockReq, res as unknown as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
  });

  it('responds with 400 and validation details for ZodError', () => {
    const res = makeMockRes();
    const zodErr = new ZodError([
      { code: 'invalid_type', expected: 'string', received: 'number', path: ['name'], message: 'Expected string' },
    ]);

    errorHandler(zodErr, mockReq, res as unknown as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation failed',
      details: zodErr.errors,
    });
  });

  it('responds with 500 for generic errors', () => {
    const res = makeMockRes();
    const err = new Error('Something broke');

    errorHandler(err, mockReq, res as unknown as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
