import { api } from './client.js';
import type { Notification } from '@trello-clone/shared';

interface NotificationsResponse {
  notifications: Notification[];
  nextCursor: string | null;
}

export async function listNotifications(unreadOnly = false, cursor?: string, limit = 20): Promise<NotificationsResponse> {
  const params = new URLSearchParams();
  if (unreadOnly) params.set('unreadOnly', 'true');
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));
  const { data } = await api.get(`/notifications?${params}`);
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get('/notifications/unread-count');
  return data.count;
}

export async function markAsRead(notificationId: string): Promise<void> {
  await api.patch(`/notifications/${notificationId}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await api.post('/notifications/read-all');
}
