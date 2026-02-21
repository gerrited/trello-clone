import { z } from 'zod';

export const createUserShareSchema = z.object({
  email: z.string().email(),
  permission: z.enum(['read', 'comment', 'edit']),
  expiresAt: z.string().datetime().optional(),
});

export const createLinkShareSchema = z.object({
  permission: z.enum(['read', 'comment', 'edit']),
  expiresAt: z.string().datetime().optional(),
});

export const updateShareSchema = z.object({
  permission: z.enum(['read', 'comment', 'edit']).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});
