import { api } from './client.js';
import type { Team, CreateTeamInput } from '@trello-clone/shared';

export async function listTeams(): Promise<(Team & { role: string })[]> {
  const { data } = await api.get<{ teams: (Team & { role: string })[] }>('/teams');
  return data.teams;
}

export async function createTeam(input: CreateTeamInput): Promise<Team> {
  const { data } = await api.post<{ team: Team }>('/teams', input);
  return data.team;
}

export async function deleteTeam(teamId: string): Promise<void> {
  await api.delete(`/teams/${teamId}`);
}
