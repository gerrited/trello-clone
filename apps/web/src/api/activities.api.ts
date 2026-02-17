import { api } from './client.js';
import type { Activity } from '@trello-clone/shared';

interface ActivitiesResponse {
  activities: Activity[];
  nextCursor: string | null;
}

export async function listBoardActivities(boardId: string, cursor?: string, limit = 20): Promise<ActivitiesResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));
  const { data } = await api.get(`/boards/${boardId}/activities?${params}`);
  return data;
}

export async function listCardActivities(cardId: string, cursor?: string, limit = 20): Promise<ActivitiesResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));
  const { data } = await api.get(`/cards/${cardId}/activities?${params}`);
  return data;
}
