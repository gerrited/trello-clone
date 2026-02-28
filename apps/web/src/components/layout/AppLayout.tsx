import { useState, useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Search } from 'lucide-react';
import { NotificationBell } from './NotificationBell.js';
import { useNotifications } from '../../hooks/useNotifications.js';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js';
import { CommandPalette } from '../../features/boards/CommandPalette.js';
import { UserMenu } from '../../features/auth/UserMenu.js';

export function AppLayout({ children }: { children: ReactNode }) {
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Initialize global notification listener
  useNotifications();

  // Global keyboard shortcut for command palette
  const shortcutHandlers = useMemo(
    () => ({
      onOpenCommandPalette: () => setShowCommandPalette(true),
    }),
    [],
  );
  useKeyboardShortcuts(shortcutHandlers);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 h-12 sm:h-14 flex items-center justify-between">
          <Link to="/teams" className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
            Trello Clone
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setShowCommandPalette(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Suche (Ctrl+K)"
            >
              <Search size={14} />
              <span className="hidden sm:inline text-xs">Suche</span>
              <kbd className="hidden sm:inline text-[10px] px-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                ⌘K
              </kbd>
            </button>
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>
      <main>{children}</main>
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />
    </div>
  );
}
