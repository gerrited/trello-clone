import { useState, useRef, useEffect } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { useBoardStore } from '../../stores/boardStore.js';
import * as cardsApi from '../../api/cards.api.js';
import { toast } from 'sonner';

interface MoveCardPopoverProps {
  boardId: string;
  cardId: string;
  currentColumnId: string;
  currentSwimlaneId: string;
  onMoved?: (toColumnId: string, toSwimlaneId: string, newPosition: string) => void;
  stopPropagation?: boolean;
  children: React.ReactNode;
  triggerClassName?: string;
}

export function MoveCardPopover({
  boardId,
  cardId,
  currentColumnId,
  currentSwimlaneId,
  onMoved,
  stopPropagation,
  children,
  triggerClassName,
}: MoveCardPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const columns = useBoardStore((s) => s.board?.columns ?? []);
  const swimlanes = useBoardStore((s) => s.board?.swimlanes ?? []);
  const moveCardInStore = useBoardStore((s) => s.moveCard);

  const isMultiSwimlane = swimlanes.length > 1;

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMoveToColumn = async (targetColumnId: string) => {
    if (targetColumnId === currentColumnId || isMoving) return;
    setIsMoving(true);
    try {
      const moved = await cardsApi.moveCard(boardId, cardId, {
        columnId: targetColumnId,
        afterId: null,
        swimlaneId: currentSwimlaneId,
      });
      moveCardInStore(cardId, moved.columnId, moved.swimlaneId, moved.position);
      onMoved?.(moved.columnId, moved.swimlaneId, moved.position);
      setIsOpen(false);
    } catch {
      toast.error('Karte konnte nicht verschoben werden');
    } finally {
      setIsMoving(false);
    }
  };

  const handleMoveToSwimlane = async (targetSwimlaneId: string) => {
    if (targetSwimlaneId === currentSwimlaneId || isMoving) return;
    setIsMoving(true);
    try {
      const moved = await cardsApi.moveCard(boardId, cardId, {
        columnId: currentColumnId,
        afterId: null,
        swimlaneId: targetSwimlaneId,
      });
      moveCardInStore(cardId, moved.columnId, moved.swimlaneId, moved.position);
      onMoved?.(moved.columnId, moved.swimlaneId, moved.position);
      setIsOpen(false);
    } catch {
      toast.error('Karte konnte nicht verschoben werden');
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <div
      className="relative inline-block"
      ref={containerRef}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      <button
        type="button"
        className={triggerClassName}
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          setDropdownPos({ top: rect.bottom + 4, left: rect.left });
          setIsOpen((prev) => !prev);
        }}
        title="Karte verschieben"
      >
        {children}
      </button>

      {isOpen && dropdownPos && (
        <div
          className="fixed z-50 w-52 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {/* Column section */}
          <div className="px-3 py-2 border-b border-gray-100">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Spalte wechseln</h4>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {columns.map((column) => {
              const isCurrent = column.id === currentColumnId;
              return (
                <button
                  key={column.id}
                  type="button"
                  disabled={isCurrent || isMoving}
                  onClick={() => handleMoveToColumn(column.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    isCurrent
                      ? 'text-blue-700 font-medium cursor-default'
                      : 'text-gray-700 hover:bg-gray-50 cursor-pointer'
                  } disabled:opacity-60`}
                >
                  {isCurrent ? (
                    <Check size={14} className="text-blue-600 flex-shrink-0" />
                  ) : (
                    <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
                  )}
                  <span className="truncate">{column.name}</span>
                </button>
              );
            })}
          </div>

          {/* Swimlane section — only for multi-swimlane boards */}
          {isMultiSwimlane && (
            <>
              <div className="px-3 py-2 border-t border-b border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Swimlane wechseln</h4>
              </div>
              <div className="max-h-48 overflow-y-auto py-1">
                {swimlanes.map((swimlane) => {
                  const isCurrent = swimlane.id === currentSwimlaneId;
                  return (
                    <button
                      key={swimlane.id}
                      type="button"
                      disabled={isCurrent || isMoving}
                      onClick={() => handleMoveToSwimlane(swimlane.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                        isCurrent
                          ? 'text-blue-700 font-medium cursor-default'
                          : 'text-gray-700 hover:bg-gray-50 cursor-pointer'
                      } disabled:opacity-60`}
                    >
                      {isCurrent ? (
                        <Check size={14} className="text-blue-600 flex-shrink-0" />
                      ) : (
                        <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
                      )}
                      <span className="truncate">{swimlane.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
