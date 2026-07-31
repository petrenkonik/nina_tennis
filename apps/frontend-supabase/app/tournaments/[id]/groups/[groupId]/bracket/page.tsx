"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import MainLayout from "app/main-layout";
import BracketView from "components/BracketView";
import { Skeleton } from "components/ui";
import { getGroupBracket, getGroupById, getTournamentById } from 'app/lib/client';
import { Tournament } from "@shared/models/tennis";

export default function BracketPage() {
  const params = useParams();
  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [group, setGroup] = useState<any>(null);
  const [error, setError] = useState('');
  const [roundFilter, setRoundFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchData() {
      setError('');
      try {
        const [foundGroup, foundTournament, bracket] = await Promise.all([
          getGroupById(groupId).catch(() => null),
          getTournamentById(id).catch(() => null),
          getGroupBracket(groupId),
        ]);
        if (foundGroup) setGroup(foundGroup);
        if (foundTournament) setTournament(foundTournament as Tournament);
        setRounds(bracket.rounds || []);
      } catch (e: any) {
        setError(e.message || 'Ошибка загрузки сетки');
      }
      setLoading(false);
    }
    if (id && groupId) fetchData();
  }, [id, groupId]);

  if (loading) {
    return (
      <MainLayout header="Сетка">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-4 overflow-hidden">
            <Skeleton className="h-96 w-60" />
            <Skeleton className="h-96 w-60" />
            <Skeleton className="h-96 w-60" />
          </div>
        </div>
      </MainLayout>
    );
  }

  const title = `Сетка${tournament?.name ? ' · ' + tournament.name : ''}${group?.name ? ' · ' + group.name : ''}`;

  // Фильтрация раундов: 'all' — показать все, иначе — только выбранный (по 1-индексу).
  const visibleRounds = roundFilter === 'all'
    ? rounds
    : rounds.filter((_, i) => String(i + 1) === roundFilter);

  return (
    <MainLayout header={title}>
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}
      <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
        <Link href={`./`} className="text-brand-600 dark:text-brand-400 underline text-sm">
          ← К списку участников
        </Link>
        {rounds.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-content-muted">
            <span>Раунд:</span>
            <select
              className="border border-surface-border rounded px-2 py-1 text-sm bg-surface-card text-content"
              value={roundFilter}
              onChange={(e) => setRoundFilter(e.target.value)}
            >
              <option value="all">Все</option>
              {rounds.map((r, i) => (
                <option key={i} value={String(i + 1)}>{r.title || `Раунд ${i + 1}`}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="rounded-xl border border-surface-border bg-surface-card p-2 sm:p-4">
        <BracketView
          rounds={visibleRounds}
          matchHref={(matchId) => `/m/${matchId}`}
          doubles={group?.format === 'doubles'}
        />
      </div>
    </MainLayout>
  );
}
