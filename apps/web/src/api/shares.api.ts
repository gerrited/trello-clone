import { api } from './client.js';
import axios from 'axios';
import type { BoardShare, BoardPermission } from '@trello-clone/shared';
import type { BoardDetail } from './boards.api.js';

export async function listShares(boardId: string): Promise<BoardShare[]> {
  const { data } = await api.get<{ shares: BoardShare[] }>(`/boards/${boardId}/shares`);
  return data.shares;
}

export async function createUserShare(
  boardId: string,
  input: { email: string; permission: BoardPermission; expiresAt?: string },
): Promise<BoardShare> {
  const { data } = await api.post<{ share: BoardShare }>(`/boards/${boardId}/shares/user`, input);
  return data.share;
}

export async function createLinkShare(
  boardId: string,
  input: { permission: BoardPermission; expiresAt?: string },
): Promise<BoardShare> {
  const { data } = await api.post<{ share: BoardShare }>(`/boards/${boardId}/shares/link`, input);
  return data.share;
}

export async function updateShare(
  boardId: string,
  shareId: string,
  input: { permission?: BoardPermission; expiresAt?: string | null },
): Promise<BoardShare> {
  const { data } = await api.patch<{ share: BoardShare }>(`/boards/${boardId}/shares/${shareId}`, input);
  return data.share;
}

export async function deleteShare(boardId: string, shareId: string): Promise<void> {
  await api.delete(`/boards/${boardId}/shares/${shareId}`);
}

/** Public endpoint — uses raw axios (no auth interceptor) */
export async function getSharedBoard(token: string): Promise<BoardDetail & { permission: BoardPermission }> {
  const { data } = await axios.get<{
    board: Record<string, unknown>;
    columns: BoardDetail['columns'];
    swimlanes: BoardDetail['swimlanes'];
    cards: BoardDetail['cards'];
    labels: BoardDetail['labels'];
    permission: BoardPermission;
  }>(`/api/v1/shared/${token}`);
  return {
    ...data.board,
    columns: data.columns,
    swimlanes: data.swimlanes,
    cards: data.cards,
    labels: data.labels,
    permission: data.permission,
  } as BoardDetail & { permission: BoardPermission };
}
