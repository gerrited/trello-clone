import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { listBoards, createBoard } from '../../api/boards.api.js';
import { AppLayout } from '../../components/layout/AppLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import type { Board } from '@trello-clone/shared';

export function BoardListPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    listBoards(teamId)
      .then(setBoards)
      .finally(() => setLoading(false));
  }, [teamId]);

  const handleCreateBoard = async () => {
    if (!teamId || !newBoardName.trim()) return;
    setCreating(true);
    try {
      const board = await createBoard(teamId, { name: newBoardName.trim() });
      setBoards((prev) => [...prev, board]);
      setNewBoardName('');
      setShowForm(false);
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
            <h1 className="text-2xl font-bold text-gray-900">Boards</h1>
          </div>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            + Board erstellen
          </Button>
        </div>

        {showForm && (
          <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
            <div className="flex gap-2">
              <Input
                placeholder="Board Name"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard()}
              />
              <Button onClick={handleCreateBoard} disabled={creating || !newBoardName.trim()}>
                {creating ? 'Erstellen...' : 'Erstellen'}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Abbrechen
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500">Laden...</p>
        ) : boards.length === 0 ? (
          <p className="text-gray-500">Noch keine Boards vorhanden.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((board) => (
              <Link
                key={board.id}
                to={`/teams/${teamId}/boards/${board.id}`}
                className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <h3 className="font-semibold text-gray-900">{board.name}</h3>
                {board.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{board.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
