import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listTeams } from '../../api/teams.api.js';
import { AppLayout } from '../../components/layout/AppLayout.js';
import type { Team } from '@trello-clone/shared';

export function TeamsPage() {
  const [teams, setTeams] = useState<(Team & { role: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTeams()
      .then(setTeams)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Meine Teams</h1>
        </div>

        {loading ? (
          <p className="text-gray-500">Laden...</p>
        ) : teams.length === 0 ? (
          <p className="text-gray-500">Du bist noch in keinem Team. Erstelle ein neues Team, um loszulegen.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <Link
                key={team.id}
                to={`/teams/${team.id}/boards`}
                className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <h3 className="font-semibold text-gray-900">{team.name}</h3>
                <p className="text-sm text-gray-500 mt-1 capitalize">{team.role}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
