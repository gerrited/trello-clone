import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore.js';
import * as notificationsApi from '../../api/notifications.api.js';
import { formatActivityMessage } from '../../utils/activityFormatter.js';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const notifications = useNotificationStore((s) => s.notifications);
  const isLoading = useNotificationStore((s) => s.isLoading);

  // Close popover on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleOpen = async () => {
    setIsOpen(!isOpen);
    if (!hasLoaded) {
      useNotificationStore.getState().setLoading(true);
      try {
        const result = await notificationsApi.listNotifications(false, undefined, 20);
        useNotificationStore.getState().setNotifications(result.notifications, result.nextCursor);
        setHasLoaded(true);
      } catch {
        useNotificationStore.getState().setLoading(false);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      useNotificationStore.getState().markAllRead();
    } catch {
      // noop
    }
  };

  const handleMarkRead = async (notificationId: string) => {
    try {
      await notificationsApi.markAsRead(notificationId);
      useNotificationStore.getState().markRead(notificationId);
    } catch {
      // noop
    }
  };

  function timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'gerade eben';
    if (diffMin < 60) return `vor ${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `vor ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `vor ${diffDays}d`;
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={handleOpen}
        className="relative p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Benachrichtigungen"
      >
        <Bell size={18} className="text-gray-600 dark:text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-[70vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Benachrichtigungen</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:underline"
              >
                Alle gelesen
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-gray-400 dark:text-gray-500">Laden...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">
                Keine Benachrichtigungen
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => {
                    if (!notif.isRead) handleMarkRead(notif.id);
                  }}
                  className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-50 dark:border-gray-700 ${
                    !notif.isRead ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {/* Avatar circle */}
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-blue-700 mt-0.5">
                      {notif.activity.user.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                        <span className="font-medium">{notif.activity.user.displayName}</span>{' '}
                        {formatActivityMessage(notif.activity)}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                        {timeAgo(notif.createdAt)}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
