import { api } from './client.js';
import type { SearchFilters, SearchResponse } from '@trello-clone/shared';

export async function searchCards(filters: SearchFilters): Promise<SearchResponse> {
  const params = new URLSearchParams();
  params.set('q', filters.q);
  if (filters.teamId) params.set('teamId', filters.teamId);
  if (filters.boardId) params.set('boardId', filters.boardId);
  if (filters.labelId) params.set('labelId', filters.labelId);
  if (filters.type) params.set('type', filters.type);
  if (filters.hasDueDate !== undefined) params.set('hasDueDate', String(filters.hasDueDate));
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters.offset !== undefined) params.set('offset', String(filters.offset));

  const { data } = await api.get<SearchResponse>(`/search?${params}`);
  return data;
}
