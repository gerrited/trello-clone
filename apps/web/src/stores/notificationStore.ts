import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Notification } from '@trello-clone/shared';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  nextCursor: string | null;

  setNotifications: (notifications: Notification[], nextCursor: string | null) => void;
  appendNotifications: (notifications: Notification[], nextCursor: string | null) => void;
  setUnreadCount: (count: number) => void;
  incrementUnreadCount: () => void;
  addNotification: (notification: Notification) => void;
  markRead: (notificationId: string) => void;
  markAllRead: () => void;
  setLoading: (loading: boolean) => void;
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    (set) => ({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      nextCursor: null,

      setNotifications: (notifications, nextCursor) =>
        set({ notifications, nextCursor, isLoading: false }),

      appendNotifications: (newNotifications, nextCursor) =>
        set((state) => ({
          notifications: [...state.notifications, ...newNotifications],
          nextCursor,
          isLoading: false,
        })),

      setUnreadCount: (count) => set({ unreadCount: count }),

      incrementUnreadCount: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),

      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        })),

      markRead: (notificationId) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n,
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        })),

      markAllRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        })),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    { name: 'NotificationStore' },
  ),
);
