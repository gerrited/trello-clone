import { api } from './client.js';
import type { Column, CreateColumnInput, UpdateColumnInput, MoveColumnInput } from '@trello-clone/shared';

export async function createColumn(boardId: string, input: CreateColumnInput): Promise<Column> {
  const { data } = await api.post<{ column: Column }>(`/boards/${boardId}/columns`, input);
  return data.column;
}

export async function updateColumn(boardId: string, columnId: string, input: UpdateColumnInput): Promise<Column> {
  const { data } = await api.patch<{ column: Column }>(`/boards/${boardId}/columns/${columnId}`, input);
  return data.column;
}

export async function moveColumn(boardId: string, columnId: string, input: MoveColumnInput): Promise<Column> {
  const { data } = await api.patch<{ column: Column }>(`/boards/${boardId}/columns/${columnId}/move`, input);
  return data.column;
}

export async function deleteColumn(boardId: string, columnId: string): Promise<void> {
  await api.delete(`/boards/${boardId}/columns/${columnId}`);
}
