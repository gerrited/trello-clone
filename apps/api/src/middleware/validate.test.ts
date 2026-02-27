import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { validate, validateQuery } from './validate.js';

function makeMockReq(overrides: Record<string, unknown> = {}) {
  return { body: {}, query: {}, ...overrides } as unknown as Request;
}

const mockRes = {} as unknown as Response;

// ---------------------------------------------------------------------------
// validate (req.body)
// ---------------------------------------------------------------------------

describe('validate', () => {
  const schema = z.object({ name: z.string(), age: z.number() });
  const middleware = validate(schema);

  it('calls next() and sets req.body to parsed data on valid input', () => {
    const req = makeMockReq({ body: { name: 'Alice', age: 30 } });
    const next = vi.fn();

    middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'Alice', age: 30 });
  });

  it('calls next(error) with ZodError on invalid input', () => {
    const req = makeMockReq({ body: { name: 123 } });
    const next = vi.fn();

    middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledOnce();
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ZodError);
  });
});

// ---------------------------------------------------------------------------
// validateQuery (req.query)
// ---------------------------------------------------------------------------

describe('validateQuery', () => {
  const schema = z.object({ page: z.coerce.number(), q: z.string().optional() });
  const middleware = validateQuery(schema);

  it('calls next() and updates req.query with coerced data on valid input', () => {
    const req = makeMockReq({ query: { page: '2', q: 'test' } });
    const next = vi.fn();

    middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ page: 2, q: 'test' });
  });

  it('calls next(error) with ZodError on invalid input', () => {
    const req = makeMockReq({ query: { page: 'not-a-number' } });
    const next = vi.fn();

    middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledOnce();
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ZodError);
  });
});
