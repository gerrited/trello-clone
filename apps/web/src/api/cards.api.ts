import { api } from './client.js';
import type { Card, CreateCardInput, UpdateCardInput, MoveCardInput } from '@trello-clone/shared';

export async function createCard(boardId: string, input: CreateCardInput): Promise<Card> {
  const { data } = await api.post<{ card: Card }>(`/boards/${boardId}/cards`, input);
  return data.card;
}

export async function getCard(boardId: string, cardId: string): Promise<Card> {
  const { data } = await api.get<{ card: Card }>(`/boards/${boardId}/cards/${cardId}`);
  return data.card;
}

export async function updateCard(boardId: string, cardId: string, input: UpdateCardInput): Promise<Card> {
  const { data } = await api.patch<{ card: Card }>(`/boards/${boardId}/cards/${cardId}`, input);
  return data.card;
}

export async function moveCard(boardId: string, cardId: string, input: MoveCardInput): Promise<Card> {
  const { data } = await api.patch<{ card: Card }>(`/boards/${boardId}/cards/${cardId}/move`, input);
  return data.card;
}

export async function deleteCard(boardId: string, cardId: string): Promise<void> {
  await api.delete(`/boards/${boardId}/cards/${cardId}`);
}
