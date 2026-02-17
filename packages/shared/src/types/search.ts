import type { CardType } from './card.js';

export interface SearchFilters {
  q: string;
  teamId?: string;
  boardId?: string;
  labelId?: string;
  type?: CardType;
  hasDueDate?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  cardType: CardType;
  dueDate: string | null;
  labels: Array<{ id: string; name: string; color: string }>;
  boardId: string;
  boardName: string;
  teamId: string;
  columnId: string;
  columnName: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  hasMore: boolean;
}
