import { api } from './client.js';
import type { Swimlane, CreateSwimlaneInput, UpdateSwimlaneInput, MoveSwimlaneInput } from '@trello-clone/shared';

export async function createSwimlane(boardId: string, input: CreateSwimlaneInput): Promise<Swimlane> {
  const { data } = await api.post<{ swimlane: Swimlane }>(`/boards/${boardId}/swimlanes`, input);
  return data.swimlane;
}

export async function updateSwimlane(boardId: string, swimlaneId: string, input: UpdateSwimlaneInput): Promise<Swimlane> {
  const { data } = await api.patch<{ swimlane: Swimlane }>(`/boards/${boardId}/swimlanes/${swimlaneId}`, input);
  return data.swimlane;
}

export async function moveSwimlane(boardId: string, swimlaneId: string, input: MoveSwimlaneInput): Promise<Swimlane> {
  const { data } = await api.patch<{ swimlane: Swimlane }>(`/boards/${boardId}/swimlanes/${swimlaneId}/move`, input);
  return data.swimlane;
}

export async function deleteSwimlane(boardId: string, swimlaneId: string): Promise<void> {
  await api.delete(`/boards/${boardId}/swimlanes/${swimlaneId}`);
}
