import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Search, X } from 'lucide-react';
import { Modal } from '../../components/ui/Modal.js';
import { searchCards } from '../../api/search.api.js';
import { useBoardStore } from '../../stores/boardStore.js';
import type { SearchResult, CardType } from '@trello-clone/shared';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const CARD_TYPE_COLORS: Record<CardType, string> = {
  task: 'bg-blue-100 text-blue-700',
  story: 'bg-green-100 text-green-700',
  bug: 'bg-red-100 text-red-700',
};

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterType, setFilterType] = useState<CardType | null>(null);
  const [filterHasDueDate, setFilterHasDueDate] = useState<boolean | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setFilterType(null);
      setFilterHasDueDate(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await searchCards({
          q: query,
          ...(filterType ? { type: filterType } : {}),
          ...(filterHasDueDate !== null ? { hasDueDate: filterHasDueDate } : {}),
          limit: 30,
        });
        setResults(response.results);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, filterType, filterHasDueDate]);

  // Navigate to selected card
  const handleSelect = useCallback(
    (result: SearchResult) => {
      navigate(`/teams/${result.teamId}/boards/${result.boardId}`);
      // Open the card detail after navigation settles
      setTimeout(() => {
        useBoardStore.getState().openCard(result.id);
      }, 500);
      onClose();
    },
    [navigate, onClose],
  );

  // Keyboard navigation within the list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  // Group results by board
  const groupedResults = results.reduce<Record<string, SearchResult[]>>((acc, result) => {
    const key = `${result.boardId}::${result.boardName}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(result);
    return acc;
  }, {});

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Suche">
      <div className="flex flex-col" style={{ minHeight: '400px', maxHeight: '70vh' }}>
        {/* Search input */}
        <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Karten suchen..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm outline-none bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex-wrap">
          {(['task', 'story', 'bug'] as CardType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? null : type)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                filterType === type
                  ? CARD_TYPE_COLORS[type] + ' border-transparent'
                  : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {type}
            </button>
          ))}
          <button
            onClick={() => setFilterHasDueDate(filterHasDueDate === true ? null : true)}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              filterHasDueDate === true
                ? 'bg-orange-100 text-orange-700 border-transparent'
                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Mit Fälligkeitsdatum
          </button>
          <button
            onClick={() => setFilterHasDueDate(filterHasDueDate === false ? null : false)}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              filterHasDueDate === false
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-transparent'
                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Ohne Datum
          </button>
        </div>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">Suche...</div>
          ) : query.length < 2 ? (
            <div className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">
              Mindestens 2 Zeichen eingeben, um zu suchen
            </div>
          ) : results.length === 0 && query ? (
            <div className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">
              Keine Ergebnisse für &quot;{query}&quot;
            </div>
          ) : (
            <ul className="py-2">
              {Object.entries(groupedResults).map(([boardKey, boardResults]) => {
                const boardName = boardKey.split('::')[1];
                return (
                  <li key={boardKey}>
                    {/* Board group header */}
                    <div className="px-3 py-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      {boardName}
                    </div>
                    {boardResults.map((result) => {
                      const flatIndex = results.indexOf(result);
                      return (
                        <button
                          key={result.id}
                          onClick={() => handleSelect(result)}
                          className={`w-full text-left px-3 py-2.5 transition-colors flex items-start gap-2 ${
                            flatIndex === selectedIndex ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          {/* Type badge */}
                          <span
                            className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5 ${CARD_TYPE_COLORS[result.cardType]}`}
                          >
                            {result.cardType}
                          </span>
                          <div className="min-w-0 flex-1">
                            {/* Title */}
                            <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{result.title}</p>
                            {/* Breadcrumb */}
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{result.columnName}</p>
                            {/* Labels + due date */}
                            {(result.labels.length > 0 || result.dueDate) && (
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {result.labels.map((label) => (
                                  <span
                                    key={label.id}
                                    className="inline-block w-2 h-2 rounded-full"
                                    style={{ backgroundColor: label.color }}
                                    title={label.name}
                                  />
                                ))}
                                {result.dueDate && (
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                    {new Date(result.dueDate).toLocaleDateString('de-DE', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-4 text-[10px] text-gray-400 dark:text-gray-500">
          <span>
            <kbd className="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-1">↑↓</kbd> Navigieren
          </span>
          <span>
            <kbd className="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-1">Enter</kbd> Öffnen
          </span>
          <span>
            <kbd className="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-1">Esc</kbd> Schliessen
          </span>
        </div>
      </div>
    </Modal>
  );
}
