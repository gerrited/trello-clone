import { z } from 'zod';

export const searchSchema = z.object({
  q: z.string().min(1).max(200),
  teamId: z.string().uuid().optional(),
  boardId: z.string().uuid().optional(),
  labelId: z.string().uuid().optional(),
  type: z.enum(['story', 'bug', 'task']).optional(),
  hasDueDate: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SearchInput = z.infer<typeof searchSchema>;
