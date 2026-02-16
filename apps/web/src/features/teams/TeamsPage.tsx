import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listTeams, createTeam, deleteTeam } from '../../api/teams.api.js';
import { AppLayout } from '../../components/layout/AppLayout.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import type { Team } from '@trello-clone/shared';

export function TeamsPage() {
  const [teams, setTeams] = useState<(Team & { role: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listTeams()
      .then(setTeams)
      .finally(() => setLoading(false));
  }, []);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreating(true);
    try {
      const team = await createTeam({ name: newTeamName.trim() });
      setTeams((prev) => [...prev, { ...team, role: 'owner' }]);
      setNewTeamName('');
      setShowForm(false);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Möchtest du dieses Team wirklich löschen?')) return;
    try {
      await deleteTeam(teamId);
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
    } catch {
      // ignore
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Meine Teams</h1>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            + Team erstellen
          </Button>
        </div>

        {showForm && (
          <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
            <div className="flex gap-2">
              <Input
                placeholder="Team Name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
                autoFocus
              />
              <Button onClick={handleCreateTeam} disabled={creating || !newTeamName.trim()}>
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
        ) : teams.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">Du bist noch in keinem Team.</p>
            <Button onClick={() => setShowForm(true)}>Erstes Team erstellen</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <div
                key={team.id}
                className="relative group p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <Link to={`/teams/${team.id}/boards`} className="block">
                  <h3 className="font-semibold text-gray-900">{team.name}</h3>
                  <p className="text-sm text-gray-500 mt-1 capitalize">{team.role}</p>
                </Link>
                {team.role === 'owner' && (
                  <button
                    onClick={() => handleDeleteTeam(team.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1"
                    title="Team löschen"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
