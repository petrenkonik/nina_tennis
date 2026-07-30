"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import MainMenu from '../../../components/MainMenu';
import { Tournament } from '@shared/models/tennis';
import { getTournamentById, getClubs } from 'app/lib/api';
import Link from 'next/link';
import MainLayout from 'app/main-layout';

function AllGroups({ groups, tournamentId }: { groups: any[]; tournamentId: string }) {
  return (
    <section>
      <div className="space-y-2">
        {groups.map(group => (
          <Link
            key={group._id}
            href={`/tournaments/${tournamentId}/groups/${group._id}/`}
            className="block border rounded p-3 bg-gray-50 hover:bg-blue-50 transition"
          >
            <div className="font-medium">{group.name}</div>
            <div className="text-xs text-gray-500">
              Участников: {typeof group.playersCount === 'number' ? group.playersCount : (group.players?.length || 0)}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function TournamentPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchTournament() {
      setLoading(true);
      setError('');
      try {
        setTournament(await getTournamentById(id));
        setClubs(await getClubs());
      } catch (e: any) {
        setError(e.message || 'Ошибка');
      }
      setLoading(false);
    }
    if (id) fetchTournament();
  }, [id]);

  if (loading) return <main className="max-w-3xl mx-auto py-8 px-4 pb-24">Загрузка...</main>;
  if (error || !tournament) return <main className="max-w-3xl mx-auto py-8 px-4 pb-24"><div className="text-red-500 font-bold">{error || 'Турнир не найден'}</div><MainMenu /></main>;

  const clubName = tournament.clubId ? clubs.find(c => c._id === tournament.clubId)?.name : null;

  return (
    <MainLayout header={tournament.name}>
      {clubName && <div className="text-blue-700 text-sm mb-2">Клуб: {clubName}</div>}
      <div className="text-gray-500 mb-4">{new Date(tournament.startDate).toLocaleDateString('ru-RU')} — {new Date(tournament.endDate).toLocaleDateString('ru-RU')}</div>
      <div className="mb-4">
        <Link
          href={`/tournaments/${tournament._id}/schedule`}
          className="inline-flex items-center gap-2 rounded-lg border border-surface-border bg-surface-card hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-colors px-3 py-2 text-sm font-medium"
        >
          📅 Расписание игр
        </Link>
      </div>
      <h2 className="font-semibold mb-2">Группы</h2>
      {tournament.groups && tournament.groups.length > 0 ? (
        <AllGroups groups={tournament.groups} tournamentId={tournament._id} />
      ) : (
        <div className="text-gray-400">Группы не найдены</div>
      )}
      <MainMenu />
    </MainLayout>
  );
} 