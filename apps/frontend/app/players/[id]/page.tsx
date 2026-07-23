"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import MainLayout from 'app/main-layout';
import { Skeleton, StatusBadge, ScorePill, Card, CardBody } from 'components/ui';
import { getPlayerById, getPlayerMatches, getPlayerAvatarUrl } from 'app/lib/api';
import { cx } from 'components/ui/cx';
import { parseScore } from 'components/ui/ScorePill';
import type { Match, Player } from '@shared/models/tennis';

export default function PlayerProfilePage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [player, setPlayer] = useState<Player | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setError('');
      try {
        const [p, m] = await Promise.all([
          getPlayerById(id),
          getPlayerMatches(id),
        ]);
        setPlayer(p as Player);
        setMatches((m || []) as Match[]);
      } catch (e: any) {
        setError(e.message || 'Ошибка загрузки игрока');
      }
      setLoading(false);
    }
    if (id) load();
  }, [id]);

  // Разделение матчей
  const { finished, upcoming } = useMemo(() => {
    const finished: Match[] = [];
    const upcoming: Match[] = [];
    for (const m of matches) {
      if (m.status === 'finished') finished.push(m);
      else if (m.status === 'scheduled' || m.status === 'in_progress') upcoming.push(m);
    }
    // Завершённые — новые сверху
    finished.sort((a, b) => {
      const ta = a.playedAt ? new Date(a.playedAt).getTime() : 0;
      const tb = b.playedAt ? new Date(b.playedAt).getTime() : 0;
      return tb - ta;
    });
    // Запланированные — раньше сверху
    upcoming.sort((a, b) => {
      const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
      const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
      return ta - tb;
    });
    return { finished, upcoming };
  }, [matches]);

  // Статистика
  const stats = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let setsWon = 0;
    let setsLost = 0;
    for (const m of finished) {
      const isP1 = String(m.player1?._id || '') === String(id);
      const me = isP1 ? 0 : 1;
      const opp = isP1 ? 1 : 0;
      const sets = parseScore(m.score);
      let mySets = 0;
      let oppSets = 0;
      for (const s of sets) {
        const myGames = isP1 ? s.p1 : s.p2;
        const oppGames = isP1 ? s.p2 : s.p1;
        if (myGames > oppGames) mySets++;
        else if (oppGames > myGames) oppSets++;
      }
      setsWon += mySets;
      setsLost += oppSets;
      const won = Boolean(m.winnerId && String(m.winnerId) === String(id));
      if (won) wins++;
      else losses++;
    }
    const played = finished.length;
    const winrate = played > 0 ? Math.round((wins / played) * 100) : 0;
    return { played, wins, losses, winrate, setsWon, setsLost };
  }, [finished, id]);

  if (loading) {
    return (
      <MainLayout header="Участник">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </MainLayout>
    );
  }

  if (error || !player) {
    return (
      <MainLayout header="Участник">
        <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 rounded mb-4 text-sm">
          {error || 'Игрок не найден'}
        </div>
        <Link href="/" className="text-brand-600 dark:text-brand-400 underline text-sm">На главную</Link>
      </MainLayout>
    );
  }

  return (
    <MainLayout header={player.fullName || 'Участник'}>
      {/* Шапка игрока */}
      <div className="flex items-center gap-4 mb-6">
        {player.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getPlayerAvatarUrl(player.photoUrl)}
            alt={player.fullName}
            className="w-20 h-20 rounded-full object-cover border-2 border-surface-border"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-surface-muted flex items-center justify-center text-3xl">🎾</div>
        )}
        <div>
          <h1 className="text-xl font-extrabold text-content">{player.fullName}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-content-muted mt-1">
            {player.club && <span>🏟 {player.club}</span>}
            {player.birthYear && <span>📅 {player.birthYear}</span>}
            {player.gender && <span>{player.gender === 'М' ? '♂ Муж' : '♀ Жен'}</span>}
            {player.rating != null && <span>⭐ Рейтинг {player.rating}</span>}
            {player.seed && <span>🌱 Посев #{player.seed}</span>}
          </div>
        </div>
      </div>

      {/* Статистика */}
      <h2 className="font-bold text-content mb-2">Статистика</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Сыграно" value={stats.played} />
        <StatCard label="Победы" value={stats.wins} accent="emerald" />
        <StatCard label="Поражения" value={stats.losses} accent="rose" />
        <StatCard label="Винрейт" value={`${stats.winrate}%`} />
        <StatCard label="Сеты выиграно" value={stats.setsWon} className="col-span-2 sm:col-span-2" />
        <StatCard label="Сеты проиграно" value={stats.setsLost} className="col-span-2 sm:col-span-2" />
      </div>

      {/* Запланированные / текущие */}
      {upcoming.length > 0 && (
        <section className="mb-6">
          <h2 className="font-bold text-content mb-2">
            📅 Запланировано / идёт
            <span className="ml-2 text-sm font-normal text-content-muted">{upcoming.length}</span>
          </h2>
          <div className="space-y-2">
            {upcoming.map((m) => (
              <PlayerMatchRow key={String(m._id)} match={m} playerId={String(id)} />
            ))}
          </div>
        </section>
      )}

      {/* Сыгранные */}
      <section>
        <h2 className="font-bold text-content mb-2">
          🏁 Сыгранные матчи
          {finished.length === 0 && <span className="ml-2 text-sm font-normal text-content-muted">пока нет</span>}
        </h2>
        {finished.length > 0 && (
          <div className="space-y-2">
            {finished.map((m) => (
              <PlayerMatchRow key={String(m._id)} match={m} playerId={String(id)} />
            ))}
          </div>
        )}
      </section>
    </MainLayout>
  );
}

function StatCard({
  label,
  value,
  accent,
  className,
}: {
  label: string;
  value: number | string;
  accent?: 'emerald' | 'rose';
  className?: string;
}) {
  return (
    <div className={cx(
      'rounded-xl border border-surface-border bg-surface-card p-3 text-center',
      className,
    )}>
      <div className="text-[0.65rem] uppercase text-content-muted mb-0.5">{label}</div>
      <div className={cx(
        'text-2xl font-extrabold tabular-nums',
        accent === 'emerald' && 'text-emerald-600 dark:text-emerald-400',
        accent === 'rose' && 'text-rose-600 dark:text-rose-400',
        !accent && 'text-content',
      )}>
        {value}
      </div>
    </div>
  );
}

function PlayerMatchRow({ match, playerId }: { match: Match; playerId: string }) {
  const p1 = match.player1;
  const p2 = match.player2;
  const isP1 = String(p1?._id || '') === playerId;
  const me = isP1 ? p1 : p2;
  const opp = isP1 ? p2 : p1;
  const won = Boolean(match.winnerId && String(match.winnerId) === playerId);
  const isFinished = match.status === 'finished';

  const dateStr = match.playedAt || match.scheduledAt;
  const dateLabel = dateStr
    ? new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const timeLabel = match.scheduledAt
    ? new Date(match.scheduledAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <Link
      href={`/m/${match._id}`}
      className={cx(
        'block rounded-lg border bg-surface-card transition-colors p-3 hover:border-brand-400 hover:bg-brand-50/30 dark:hover:bg-brand-900/10',
        isFinished
          ? (won ? 'border-emerald-300 dark:border-emerald-700/50' : 'border-surface-border')
          : 'border-surface-border',
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          {isFinished ? (
            <span className={cx(
              'text-xs font-bold px-1.5 py-0.5 rounded',
              won ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
            )}>
              {won ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'}
            </span>
          ) : (
            match.status && <StatusBadge status={match.status} />
          )}
          {match.court && <span className="text-[0.65rem] text-content-muted">🏟 {match.court}</span>}
        </div>
        <div className="flex items-center gap-2 text-[0.65rem] text-content-muted">
          {dateLabel && <span>{dateLabel}</span>}
          {timeLabel && <span className="font-mono">{timeLabel}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-content">{me?.fullName || '—'}</span>
        <span className="text-[0.65rem] font-bold text-content-muted px-1">VS</span>
        {opp?._id ? (
          <Link
            href={`/players/${opp._id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-content truncate hover:text-brand-600 dark:hover:text-brand-400"
          >
            {opp.fullName || '—'}
          </Link>
        ) : (
          <span className="text-sm font-medium text-content-muted truncate">{opp?.fullName || '—'}</span>
        )}
        <div className="ml-auto">
          <ScorePill score={match.score} compact />
        </div>
      </div>
    </Link>
  );
}
