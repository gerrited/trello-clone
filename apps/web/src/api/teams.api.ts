import { api } from './client.js';
import type { Team } from '@trello-clone/shared';

export async function listTeams(): Promise<(Team & { role: string })[]> {
  const { data } = await api.get<{ teams: (Team & { role: string })[] }>('/teams');
  return data.teams;
}
