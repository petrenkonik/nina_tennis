"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import MainMenu from '../../../../../components/MainMenu';
import MainLayout from 'app/main-layout';
import { getGroupById, getSeededPlayers, getTournamentById } from 'app/lib/client';
import PlayerCard from '../../../../components/PlayerCard';
import Link from "next/link";

export default function GroupPage() {
  const params = useParams();
  const tournamentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  const [tournament, setTournament] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [seededPlayers, setSeededPlayers] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchGroup() {
      setLoading(true);
      setError('');
      try {
        const tournament = await getTournamentById(tournamentId);
        
        const foundGroup = await getGroupById(groupId);
        if (!foundGroup) throw new Error('Группа не найдена');
        const seededPlayers = await getSeededPlayers(groupId);
        setGroup(foundGroup);
        setTournament(tournament);
        setSeededPlayers(seededPlayers);
      } catch (e: any) {
        setError(e.message || 'Ошибка');
      }
      setLoading(false);
    }
    if (tournamentId && groupId) fetchGroup();
  }, [tournamentId, groupId]);

  if (loading) return <MainLayout header="Группа">Загрузка...</MainLayout>;
  if (error || !group) return <MainLayout header="Группа"><div className="text-red-500 font-bold">{error || 'Группа не найдена'}</div><MainMenu /></MainLayout>;

  return (
    <MainLayout header={tournament.name+":"+group.name}>
      <div className="mb-4">
        <Link href={`/tournaments/${tournamentId}/groups/${groupId}/bracket`} className="text-blue-600 underline">Перейти к турнирной сетке →</Link>
      </div>
      <h2 className="font-semibold mb-2">Участники</h2>
      {group.players && group.players.length > 0 ? (
        <ul className="space-y-2">
          {group.players.map((player: any) => (
            <PlayerCard key={player.id || player._id} player={player} />
          ))}
        </ul>
      ) : (
        <div className="text-gray-400">Нет участников</div>
      )}
    </MainLayout>
  );
} 