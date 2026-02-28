import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { listBoards, createBoard } from '../../api/boards.api.js';
import { createBoardFromTemplate } from '../../api/templates.api.js';
import { AppLayout } from '../../components/layout/AppLayout.js';
import { Button } from '../../components/ui/Button.js';
import { TemplatePicker } from './TemplatePicker.js';
import type { Board } from '@trello-clone/shared';

export function BoardListPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    listBoards(teamId)
      .then(setBoards)
      .finally(() => setLoading(false));
  }, [teamId]);

  const handleCreateBoard = async (templateId: string | null, boardName: string) => {
    if (!teamId) return;
    setCreating(true);
    try {
      let board: Board;
      if (templateId) {
        board = await createBoardFromTemplate(teamId, { name: boardName, templateId });
      } else {
        board = await createBoard(teamId, { name: boardName });
      }
      setBoards((prev) => [...prev, board]);
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/teams" className="text-sm text-blue-600 hover:underline">
              &larr; Teams
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Boards</h1>
          </div>
          <Button
            size="sm"
            onClick={() => setShowTemplatePicker(true)}
            disabled={creating}
          >
            {creating ? 'Erstellen...' : '+ Board erstellen'}
          </Button>
        </div>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Laden...</p>
        ) : boards.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">Noch keine Boards vorhanden.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((board) => (
              <Link
                key={board.id}
                to={`/teams/${teamId}/boards/${board.id}`}
                className="block p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all"
              >
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{board.name}</h3>
                {board.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{board.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}

        <TemplatePicker
          isOpen={showTemplatePicker}
          onClose={() => setShowTemplatePicker(false)}
          teamId={teamId ?? ''}
          onSelectTemplate={handleCreateBoard}
        />
      </div>
    </AppLayout>
  );
}
