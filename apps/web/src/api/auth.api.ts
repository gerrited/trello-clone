import { api } from './client.js';
import type { User, LoginResponse, RegisterInput, LoginInput } from '@trello-clone/shared';

export async function registerUser(input: RegisterInput): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/register', input);
  return data;
}

export async function loginUser(input: LoginInput): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', input);
  return data;
}

export async function getMe(): Promise<{ user: User }> {
  const { data } = await api.get<{ user: User }>('/auth/me');
  return data;
}

export async function logoutUser(): Promise<void> {
  await api.post('/auth/logout');
}
