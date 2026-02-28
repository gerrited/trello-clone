import { api } from './client.js';
import type { User, UpdateProfileInput, ChangePasswordInput } from '@trello-clone/shared';

export async function updateProfile(input: UpdateProfileInput): Promise<{ user: User }> {
  const { data } = await api.patch<{ user: User }>('/users/me', input);
  return data;
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  await api.patch('/users/me/password', input);
}
