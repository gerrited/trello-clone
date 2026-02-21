import { api } from './client.js';
import type { Attachment } from '@trello-clone/shared';

export async function listAttachments(boardId: string, cardId: string): Promise<Attachment[]> {
  const { data } = await api.get<{ attachments: Attachment[] }>(`/boards/${boardId}/cards/${cardId}/attachments`);
  return data.attachments;
}

export async function uploadAttachment(boardId: string, cardId: string, file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<{ attachment: Attachment }>(
    `/boards/${boardId}/cards/${cardId}/attachments`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.attachment;
}

export async function deleteAttachment(boardId: string, cardId: string, attachmentId: string): Promise<void> {
  await api.delete(`/boards/${boardId}/cards/${cardId}/attachments/${attachmentId}`);
}
