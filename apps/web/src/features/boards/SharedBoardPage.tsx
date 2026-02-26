import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { BoardPermission, CardSummary } from '@trello-clone/shared';
import { getSharedBoard } from '../../api/shares.api.js';
import type { BoardDetail } from '../../api/boards.api.js';
import { useBoardStore } from '../../stores/boardStore.js';
import { setActiveShareToken } from '../../api/client.js';
import { CardDetailModal } from './CardDetailModal.js';
import { BookOpen, Bug, CheckSquare, MessageSquare, Calendar, Link2, Paperclip, Shield } from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  story: 'bg-green-100 text-green-700',
  bug: 'bg-red-100 text-red-700',
  task: 'bg-blue-100 text-blue-700',
};

function formatDueDate(dueDate: string): string {
  const d = new Date(dueDate);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

const PERM_LABELS: Record<BoardPermission, string> = {
  read: 'Nur lesen',
  comment: 'Kommentieren',
  edit: 'Bearbeiten',
};

export function SharedBoardPage() {
  const { token } = useParams<{ token: string }>();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const setBoard = useBoardStore((s) => s.setBoard);
  const clearBoard = useBoardStore((s) => s.clearBoard);
  const board = useBoardStore((s) => s.board) as (BoardDetail & { permission: BoardPermission }) | null;
  const openCard = useBoardStore((s) => s.openCard);

  useEffect(() => {
    if (!token) return;
    setActiveShareToken(token);
    setIsLoading(true);
    getSharedBoard(token)
      .then((data) => setBoard(data))
      .catch((err) => {
        const msg = err?.response?.data?.message ?? 'Board konnte nicht geladen werden';
        setError(msg);
      })
      .finally(() => setIsLoading(false));
    return () => {
      setActiveShareToken(null);
      clearBoard();
    };
  }, [token, setBoard, clearBoard]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Laden...</p>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield size={48} className="mx-auto text-gray-300 mb-4" />
          <h1 className="text-xl font-bold text-gray-700 mb-2">Zugriff nicht möglich</h1>
          <p className="text-gray-500">{error || 'Board nicht gefunden'}</p>
        </div>
      </div>
    );
  }

  // Group cards by column
  const cardsByColumn: Record<string, CardSummary[]> = {};
  for (const col of board.columns) {
    cardsByColumn[col.id] = [];
  }
  for (const card of board.cards) {
    if (cardsByColumn[card.columnId]) {
      cardsByColumn[card.columnId].push(card);
    }
  }
  for (const colId of Object.keys(cardsByColumn)) {
    cardsByColumn[colId].sort((a, b) => a.position.localeCompare(b.position));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner */}
      <div className="bg-blue-600 text-white px-4 py-2 flex items-center gap-2 text-sm">
        <Shield size={16} />
        <span>Geteilte Ansicht &mdash; {PERM_LABELS[board.permission]}</span>
        <span className="ml-auto text-blue-200 text-xs">Kein Echtzeit-Update</span>
      </div>

      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900 mb-4">{board.name}</h1>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {board.columns.map((column) => {
            const cards = cardsByColumn[column.id] || [];
            return (
              <div key={column.id} className="flex-shrink-0 w-72 bg-gray-100 rounded-lg flex flex-col">
                <div className="p-3 flex items-center gap-2 border-b border-gray-200">
                  {column.color && (
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />
                  )}
                  <h3 className="font-semibold text-sm text-gray-700 truncate">{column.name}</h3>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">
                    {cards.length}
                  </span>
                </div>
                <div className="p-2 space-y-2 flex-1">
                  {cards.map((card) => (
                    <ReadOnlyCard key={card.id} card={card} onClick={() => openCard(card.id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CardDetailModal />
    </div>
  );
}

function ReadOnlyCard({ card, onClick }: { card: CardSummary; onClick: () => void }) {
  const hasMetadata = card.commentCount > 0 || card.subtaskCount > 0 || card.parentCardId || card.dueDate || card.attachmentCount > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow-md transition-all" onClick={onClick}>
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {card.labels.map((label) => (
            <span
              key={label.id}
              className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium leading-tight"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
      <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[card.cardType]}`}>
        {card.cardType.charAt(0).toUpperCase() + card.cardType.slice(1)}
      </span>
      <p className="text-sm text-gray-900 mt-1">{card.title}</p>
      {hasMetadata && (
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
          {card.parentCardId && <Link2 size={12} />}
          {card.dueDate && (
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {formatDueDate(card.dueDate)}
            </span>
          )}
          {card.commentCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare size={12} />
              {card.commentCount}
            </span>
          )}
          {card.attachmentCount > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip size={12} />
              {card.attachmentCount}
            </span>
          )}
          {card.subtaskCount > 0 && (
            <span className="flex items-center gap-1">
              <CheckSquare size={12} />
              {card.subtaskDoneCount}/{card.subtaskCount}
            </span>
          )}
        </div>
      )}
      {card.assignees.length > 0 && (
        <div className="flex -space-x-1 mt-2">
          {card.assignees.map((a) => (
            <div
              key={a.id}
              className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center ring-2 ring-white"
              title={a.displayName}
            >
              {a.displayName.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
