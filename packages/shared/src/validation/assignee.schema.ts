import { z } from 'zod';

export const addAssigneeSchema = z.object({
  userId: z.string().uuid(),
});

export type AddAssigneeInput = z.infer<typeof addAssigneeSchema>;
