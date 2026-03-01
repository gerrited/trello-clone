import { z } from 'zod';

const SUPPORTED_LANGS = ['en', 'de', 'fr', 'it'] as const;

export const updateProfileSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(100),
  email: z.string().email('Invalid email address'),
  language: z.enum(SUPPORTED_LANGS).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
