import { useEffect } from 'react';
import { WS_EVENTS } from '@trello-clone/shared';
import type { Notification } from '@trello-clone/shared';
import { getSocket } from '../api/ws.js';
import { useNotificationStore } from '../stores/notificationStore.js';
import * as notificationsApi from '../api/notifications.api.js';

/**
 * Global hook that listens for real-time notifications via Socket.IO
 * and fetches the initial unread count on mount.
 * Should be called once in the app layout.
 */
export function useNotifications() {
  useEffect(() => {
    // Fetch initial unread count
    notificationsApi.getUnreadCount().then((count) => {
      useNotificationStore.getState().setUnreadCount(count);
    }).catch(() => {});

    const socket = getSocket();

    function handleNewNotification(data: { notification: Notification }) {
      useNotificationStore.getState().addNotification(data.notification);
    }

    socket.on(WS_EVENTS.NOTIFICATION_NEW, handleNewNotification);

    return () => {
      socket.off(WS_EVENTS.NOTIFICATION_NEW, handleNewNotification);
    };
  }, []);
}
