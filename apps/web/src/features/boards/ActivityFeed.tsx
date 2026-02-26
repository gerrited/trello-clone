import { useEffect, useState, useCallback } from 'react';
import type { Activity } from '@trello-clone/shared';
import { WS_EVENTS } from '@trello-clone/shared';
import * as activitiesApi from '../../api/activities.api.js';
import { formatActivityMessage } from '../../utils/activityFormatter.js';
import { getSocket } from '../../api/ws.js';

interface ActivityFeedProps {
  boardId?: string;
  cardId?: string;
  maxHeight?: string;
}

export function ActivityFeed({ boardId, cardId, maxHeight = '400px' }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivities = useCallback(async (cursor?: string) => {
    try {
      let result;
      if (cardId) {
        result = await activitiesApi.listCardActivities(cardId, cursor, 15);
      } else if (boardId) {
        result = await activitiesApi.listBoardActivities(boardId, cursor, 15);
      } else {
        return;
      }

      if (cursor) {
        setActivities((prev) => [...prev, ...result.activities]);
      } else {
        setActivities(result.activities);
      }
      setNextCursor(result.nextCursor);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [boardId, cardId]);

  useEffect(() => {
    setIsLoading(true);
    setActivities([]);
    fetchActivities();
  }, [fetchActivities]);

  // Listen for new activities in real-time (board-level)
  useEffect(() => {
    if (!boardId) return;

    const socket = getSocket();

    function handleActivityCreated(data: { activity: Activity }) {
      // For card-specific feed, only add if matching
      if (cardId && data.activity.cardId !== cardId) return;
      setActivities((prev) => [data.activity, ...prev]);
    }

    socket.on(WS_EVENTS.ACTIVITY_CREATED, handleActivityCreated);
    return () => {
      socket.off(WS_EVENTS.ACTIVITY_CREATED, handleActivityCreated);
    };
  }, [boardId, cardId]);

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

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse p-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-gray-200 rounded w-3/4" />
              <div className="h-2 bg-gray-100 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-sm text-gray-400 text-center py-4">
        Noch keine Aktivität
      </div>
    );
  }

  return (
    <div className="overflow-y-auto" style={{ maxHeight }}>
      <div className="space-y-0">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-2 px-2 py-2 hover:bg-gray-50 rounded transition-colors"
          >
            {/* Avatar */}
            <div className="w-6 h-6 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-blue-700 mt-0.5">
              {activity.user.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-700 leading-relaxed">
                <span className="font-medium">{activity.user.displayName}</span>{' '}
                {formatActivityMessage(activity)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {timeAgo(activity.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {nextCursor && (
        <button
          onClick={() => fetchActivities(nextCursor)}
          className="w-full text-xs text-blue-600 hover:underline py-2 text-center"
        >
          Mehr laden
        </button>
      )}
    </div>
  );
}
