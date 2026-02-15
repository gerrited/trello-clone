import { z } from 'zod';

export const createSwimlaneSchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateSwimlaneSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export const moveSwimlaneSchema = z.object({
  afterId: z.string().uuid().nullable(),
});

export type CreateSwimlaneInput = z.infer<typeof createSwimlaneSchema>;
export type UpdateSwimlaneInput = z.infer<typeof updateSwimlaneSchema>;
export type MoveSwimlaneInput = z.infer<typeof moveSwimlaneSchema>;
