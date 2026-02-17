import { api } from './client.js';
import type { Label } from '@trello-clone/shared';

export async function listLabels(boardId: string): Promise<Label[]> {
  const { data } = await api.get<{ labels: Label[] }>(`/boards/${boardId}/labels`);
  return data.labels;
}

export async function createLabel(boardId: string, input: { name: string; color: string }): Promise<Label> {
  const { data } = await api.post<{ label: Label }>(`/boards/${boardId}/labels`, input);
  return data.label;
}

export async function updateLabel(boardId: string, labelId: string, input: { name?: string; color?: string }): Promise<Label> {
  const { data } = await api.patch<{ label: Label }>(`/boards/${boardId}/labels/${labelId}`, input);
  return data.label;
}

export async function deleteLabel(boardId: string, labelId: string): Promise<void> {
  await api.delete(`/boards/${boardId}/labels/${labelId}`);
}

export async function addCardLabel(boardId: string, cardId: string, labelId: string): Promise<void> {
  await api.post(`/boards/${boardId}/cards/${cardId}/labels`, { labelId });
}

export async function removeCardLabel(boardId: string, cardId: string, labelId: string): Promise<void> {
  await api.delete(`/boards/${boardId}/cards/${cardId}/labels/${labelId}`);
}
