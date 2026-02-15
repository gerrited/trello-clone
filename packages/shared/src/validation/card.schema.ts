import { z } from 'zod';

export const createCardSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  cardType: z.enum(['story', 'bug', 'task']).optional(),
  columnId: z.string().uuid(),
});

export const updateCardSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  cardType: z.enum(['story', 'bug', 'task']).optional(),
  isArchived: z.boolean().optional(),
});

export const moveCardSchema = z.object({
  columnId: z.string().uuid(),
  afterId: z.string().uuid().nullable(),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type MoveCardInput = z.infer<typeof moveCardSchema>;
