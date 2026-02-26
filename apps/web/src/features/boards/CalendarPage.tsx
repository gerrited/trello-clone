import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CardSummary } from '@trello-clone/shared';
import { useBoardStore } from '../../stores/boardStore.js';
import { getBoard } from '../../api/boards.api.js';
import { AppLayout } from '../../components/layout/AppLayout.js';
import { CardDetailModal } from './CardDetailModal.js';
import { useRealtimeBoard } from '../../hooks/useRealtimeBoard.js';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_NAMES = [
  'Januar', 'Februar', 'Maerz', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function getMonthDays(year: number, month: number) {
  // month is 0-indexed
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday=0, Sunday=6 (ISO week)
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

  // Previous month padding
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }

  // Next month padding to fill the grid (6 rows × 7 = 42)
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
  }

  return days;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function CalendarPage() {
  const { teamId, boardId } = useParams<{ teamId: string; boardId: string }>();
  const board = useBoardStore((s) => s.board);
  const isLoading = useBoardStore((s) => s.isLoading);
  const openCard = useBoardStore((s) => s.openCard);

  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  useEffect(() => {
    if (!teamId || !boardId) return;
    const { setLoading: sl, setBoard: sb, clearBoard: cb } = useBoardStore.getState();
    // Only load if not already loaded (e.g. navigated from board page)
    if (!useBoardStore.getState().board || useBoardStore.getState().board?.id !== boardId) {
      sl(true);
      getBoard(teamId, boardId).then(sb).catch(() => useBoardStore.getState().setLoading(false));
    }
    return () => cb();
  }, [teamId, boardId]);

  useRealtimeBoard(boardId);

  const days = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const cardsByDay = useMemo(() => {
    if (!board) return new Map<string, CardSummary[]>();
    const map = new Map<string, CardSummary[]>();
    for (const card of board.cards) {
      if (!card.dueDate) continue;
      const d = new Date(card.dueDate);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    }
    return map;
  }, [board]);

  const navigateMonth = (delta: number) => {
    let newMonth = viewMonth + delta;
    let newYear = viewYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    setViewMonth(newMonth);
    setViewYear(newYear);
  };

  const today = new Date();

  if (isLoading || !board) {
    return (
      <AppLayout>
        <div className="px-4 py-4 animate-pulse">
          <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
          <div className="h-96 bg-gray-100 rounded-lg" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-2 sm:px-4 py-2 sm:py-4">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-4 mb-4">
          <Link to={`/teams/${teamId}/boards/${boardId}`} className="text-sm text-blue-600 hover:underline">
            &larr; Board
          </Link>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
            {board.name} — Kalender
          </h1>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-800">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h2>
            <button
              onClick={() => {
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              Heute
            </button>
          </div>
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
          {/* Weekday headers */}
          {WEEKDAYS.map((day) => (
            <div key={day} className="bg-gray-50 p-2 text-center text-xs font-medium text-gray-500">
              {day}
            </div>
          ))}

          {/* Day cells */}
          {days.map((dayInfo, index) => {
            const key = `${dayInfo.date.getFullYear()}-${dayInfo.date.getMonth()}-${dayInfo.date.getDate()}`;
            const dayCards = cardsByDay.get(key) ?? [];
            const isToday = isSameDay(dayInfo.date, today);

            return (
              <div
                key={index}
                className={`bg-white min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 ${
                  !dayInfo.isCurrentMonth ? 'opacity-40' : ''
                }`}
              >
                <div className={`text-xs mb-1 ${
                  isToday
                    ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold'
                    : 'text-gray-500'
                }`}>
                  {dayInfo.date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayCards.slice(0, 3).map((card) => {
                    const isOverdue = new Date(card.dueDate!) < today;
                    return (
                      <button
                        key={card.id}
                        onClick={() => openCard(card.id)}
                        className={`w-full text-left text-[10px] sm:text-xs px-1 py-0.5 rounded truncate cursor-pointer transition-colors ${
                          isOverdue
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                        title={card.title}
                      >
                        {card.labels.length > 0 && (
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full mr-0.5 flex-shrink-0"
                            style={{ backgroundColor: card.labels[0].color }}
                          />
                        )}
                        {card.title}
                      </button>
                    );
                  })}
                  {dayCards.length > 3 && (
                    <div className="text-[10px] text-gray-400 pl-1">
                      +{dayCards.length - 3} weitere
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <CardDetailModal />
    </AppLayout>
  );
}
