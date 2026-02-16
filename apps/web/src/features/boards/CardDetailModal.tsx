import { useEffect, useState, useCallback } from 'react';
import { X, BookOpen, Bug, CheckSquare, Trash2 } from 'lucide-react';
import type { CardDetail, CardType } from '@trello-clone/shared';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import { useBoardStore } from '../../stores/boardStore.js';
import * as cardsApi from '../../api/cards.api.js';
import { toast } from 'sonner';

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  story: BookOpen,
  bug: Bug,
  task: CheckSquare,
};

const TYPE_COLORS: Record<string, string> = {
  story: 'bg-green-100 text-green-700',
  bug: 'bg-red-100 text-red-700',
  task: 'bg-blue-100 text-blue-700',
};

export function CardDetailModal() {
  const board = useBoardStore((s) => s.board);
  const selectedCardId = useBoardStore((s) => s.selectedCardId);
  const closeCard = useBoardStore((s) => s.closeCard);
  const updateCardInStore = useBoardStore((s) => s.updateCard);
  const removeCardFromStore = useBoardStore((s) => s.removeCard);

  const [cardDetail, setCardDetail] = useState<CardDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);

  const fetchCard = useCallback(async () => {
    if (!board || !selectedCardId) return;
    setIsLoading(true);
    try {
      const detail = await cardsApi.getCard(board.id, selectedCardId);
      setCardDetail(detail);
      setTitle(detail.title);
      setDescription(detail.description ?? '');
    } catch {
      toast.error('Karte konnte nicht geladen werden');
      closeCard();
    } finally {
      setIsLoading(false);
    }
  }, [board, selectedCardId, closeCard]);

  useEffect(() => {
    if (selectedCardId) {
      setEditingTitle(false);
      setEditingDescription(false);
      fetchCard();
    } else {
      setCardDetail(null);
    }
  }, [selectedCardId, fetchCard]);

  const handleSaveTitle = async () => {
    if (!board || !cardDetail || !title.trim()) return;
    try {
      await cardsApi.updateCard(board.id, cardDetail.id, { title: title.trim() });
      updateCardInStore(cardDetail.id, { title: title.trim() });
      setCardDetail({ ...cardDetail, title: title.trim() });
      setEditingTitle(false);
    } catch {
      toast.error('Titel konnte nicht gespeichert werden');
    }
  };

  const handleSaveDescription = async () => {
    if (!board || !cardDetail) return;
    const desc = description.trim() || null;
    try {
      await cardsApi.updateCard(board.id, cardDetail.id, { description: desc });
      setCardDetail({ ...cardDetail, description: desc });
      setEditingDescription(false);
    } catch {
      toast.error('Beschreibung konnte nicht gespeichert werden');
    }
  };

  const handleChangeType = async (newType: CardType) => {
    if (!board || !cardDetail || cardDetail.cardType === newType) return;
    try {
      await cardsApi.updateCard(board.id, cardDetail.id, { cardType: newType });
      updateCardInStore(cardDetail.id, { cardType: newType });
      setCardDetail({ ...cardDetail, cardType: newType });
    } catch {
      toast.error('Kartentyp konnte nicht geaendert werden');
    }
  };

  const handleDelete = async () => {
    if (!board || !cardDetail) return;
    if (!window.confirm('Karte wirklich loeschen?')) return;
    try {
      await cardsApi.deleteCard(board.id, cardDetail.id);
      removeCardFromStore(cardDetail.id);
      closeCard();
      toast.success('Karte geloescht');
    } catch {
      toast.error('Karte konnte nicht geloescht werden');
    }
  };

  const column = board?.columns.find((c) => c.id === cardDetail?.columnId);
  const swimlane = board?.swimlanes.find((s) => s.id === cardDetail?.swimlaneId);

  return (
    <Modal isOpen={!!selectedCardId} onClose={closeCard} title="Kartendetails">
      {isLoading || !cardDetail ? (
        <div className="p-8 text-center text-gray-500">Laden...</div>
      ) : (
        <div className="p-6 space-y-6">
          {/* Header with close button */}
          <div className="flex items-start justify-between">
            <div className="flex-1 mr-4">
              {editingTitle ? (
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') {
                      setTitle(cardDetail.title);
                      setEditingTitle(false);
                    }
                  }}
                  className="w-full text-xl font-bold text-gray-900 border-b-2 border-blue-500 outline-none pb-1"
                />
              ) : (
                <h2
                  className="text-xl font-bold text-gray-900 cursor-pointer hover:text-blue-600"
                  onClick={() => setEditingTitle(true)}
                >
                  {cardDetail.title}
                </h2>
              )}
            </div>
            <button onClick={closeCard} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X size={20} />
            </button>
          </div>

          {/* Metadata row */}
          <div className="flex flex-wrap gap-3 text-sm text-gray-600">
            {column && (
              <span>
                Spalte: <strong>{column.name}</strong>
              </span>
            )}
            {swimlane && !swimlane.isDefault && (
              <span>
                Swimlane: <strong>{swimlane.name}</strong>
              </span>
            )}
          </div>

          {/* Card type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Kartentyp</label>
            <div className="flex gap-2">
              {(['task', 'story', 'bug'] as const).map((type) => {
                const Icon = TYPE_ICONS[type];
                return (
                  <button
                    key={type}
                    onClick={() => handleChangeType(type)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      cardDetail.cardType === type ? TYPE_COLORS[type] : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {Icon && <Icon size={14} />}
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Beschreibung</label>
            {editingDescription ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveDescription}>
                    Speichern
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDescription(cardDetail.description ?? '');
                      setEditingDescription(false);
                    }}
                  >
                    Abbrechen
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="text-sm text-gray-600 cursor-pointer hover:bg-gray-50 rounded-lg p-3 border border-transparent hover:border-gray-200 min-h-[3rem]"
                onClick={() => setEditingDescription(true)}
              >
                {cardDetail.description || 'Beschreibung hinzufuegen...'}
              </div>
            )}
          </div>

          {/* Assignees (display only) */}
          {cardDetail.assignees.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Zugewiesen</label>
              <div className="flex flex-wrap gap-2">
                {cardDetail.assignees.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1">
                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">
                      {a.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-700">{a.displayName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subtasks section placeholder — filled in Task 6 */}

          {/* Comments section placeholder — filled in Task 5 */}

          {/* Delete button */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800 transition-colors"
            >
              <Trash2 size={16} />
              Karte loeschen
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
