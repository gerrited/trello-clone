import { api } from './client.js';

export interface Assignee {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export async function addAssignee(
  boardId: string,
  cardId: string,
  userId: string,
): Promise<Assignee> {
  const res = await api.post<{ assignee: Assignee }>(
    `/boards/${boardId}/cards/${cardId}/assignees`,
    { userId },
  );
  return res.data.assignee;
}

export async function removeAssignee(
  boardId: string,
  cardId: string,
  userId: string,
): Promise<void> {
  await api.delete(`/boards/${boardId}/cards/${cardId}/assignees/${userId}`);
}
