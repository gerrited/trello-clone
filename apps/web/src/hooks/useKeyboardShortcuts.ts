import { useEffect, useCallback } from 'react';

interface ShortcutHandlers {
  onShowHelp?: () => void;
  onNewCard?: () => void;
  onGoToBoards?: () => void;
  onFocusFilter?: () => void;
  onToggleActivity?: () => void;
  onOpenCommandPalette?: () => void;
}

/**
 * Global keyboard shortcut listener.
 * Ignores events inside input/textarea/select/contentEditable elements.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if focus is in an input-like element
      const target = e.target as HTMLElement;
      const tagName = target.tagName;
      if (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl+K / Cmd+K → Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handlers.onOpenCommandPalette?.();
        return;
      }

      // Don't handle modified keys (except Cmd+K above)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case '?':
          e.preventDefault();
          handlers.onShowHelp?.();
          break;
        case 'n':
          e.preventDefault();
          handlers.onNewCard?.();
          break;
        case 'b':
          e.preventDefault();
          handlers.onGoToBoards?.();
          break;
        case 'f':
          e.preventDefault();
          handlers.onFocusFilter?.();
          break;
        case 'a':
          e.preventDefault();
          handlers.onToggleActivity?.();
          break;
        case '/':
          e.preventDefault();
          handlers.onOpenCommandPalette?.();
          break;
      }
    },
    [handlers],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export const SHORTCUT_LIST = [
  { keys: '?', description: 'Tastaturkuerzel anzeigen' },
  { keys: 'n', description: 'Neue Karte erstellen' },
  { keys: 'b', description: 'Zurueck zur Board-Liste' },
  { keys: 'f', description: 'Filter fokussieren' },
  { keys: 'a', description: 'Aktivitaet ein-/ausblenden' },
  { keys: 'Ctrl+K / /', description: 'Suche oeffnen' },
  { keys: 'Escape', description: 'Modals schliessen' },
];
