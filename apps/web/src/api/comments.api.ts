import { api } from './client.js';
import type { Comment, CreateCommentInput, UpdateCommentInput } from '@trello-clone/shared';

export async function listComments(boardId: string, cardId: string): Promise<Comment[]> {
  const { data } = await api.get<{ comments: Comment[] }>(`/boards/${boardId}/cards/${cardId}/comments`);
  return data.comments;
}

export async function createComment(boardId: string, cardId: string, input: CreateCommentInput): Promise<Comment> {
  const { data } = await api.post<{ comment: Comment }>(`/boards/${boardId}/cards/${cardId}/comments`, input);
  return data.comment;
}

export async function updateComment(
  boardId: string,
  cardId: string,
  commentId: string,
  input: UpdateCommentInput,
): Promise<Comment> {
  const { data } = await api.patch<{ comment: Comment }>(
    `/boards/${boardId}/cards/${cardId}/comments/${commentId}`,
    input,
  );
  return data.comment;
}

export async function deleteComment(boardId: string, cardId: string, commentId: string): Promise<void> {
  await api.delete(`/boards/${boardId}/cards/${cardId}/comments/${commentId}`);
}
