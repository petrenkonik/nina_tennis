"use client";

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import MainLayout from 'app/main-layout';
import { Skeleton, StatusBadge, ScorePill, Button } from 'components/ui';
import { FaChevronLeft, FaChevronRight, FaCalendarAlt } from 'react-icons/fa';
import { getTournamentById, getTournamentMatches } from 'app/lib/api';
import { getPlayerAvatarUrl } from 'app/lib/avatar';
import { cx } from 'components/ui/cx';
import type { Match, Tournament } from '@shared/models/tennis';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/** Ключ дня в локальном времени: 'YYYY-MM-DD'. */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function SchedulePage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Текущий просматриваемый месяц
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  // Выбранный день (ключ), null = не выбран
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError('');
      try {
        const [t, data] = await Promise.all([
          getTournamentById(id).catch(() => null),
          getTournamentMatches(id),
        ]);
        if (t) setTournament(t as Tournament);
        setMatches((data.matches || []) as Match[]);
      } catch (e: any) {
        setError(e.message || 'Ошибка загрузки расписания');
      }
      setLoading(false);
    }
    if (id) load();
  }, [id]);

  // Группировка матчей по дню
  const matchesByDay = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      const d = m.scheduledAt || m.playedAt;
      if (!d) continue;
      const key = dayKey(new Date(d));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    // сортировка по времени внутри дня
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
        const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
        return ta - tb;
      });
    }
    return map;
  }, [matches]);

  // Дни календаря для текущего месяца (понедельник — первый день недели)
  const calendarDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    // День недели первого числа (0=вс → делаем 0=пн)
    const firstWeekday = (first.getDay() + 6) % 7;
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(viewYear, viewMonth, d));
    // добиваем до кратного 7
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [viewYear, viewMonth]);

  const selectedMatches = selectedDay ? (matchesByDay.get(selectedDay) || []) : [];

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);
  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  // Первый день с матчами — для автосегментации диапазона турнира
  const daysWithMatches = useMemo(() => {
    return Array.from(matchesByDay.keys()).sort();
  }, [matchesByDay]);

  if (loading) {
    return (
      <MainLayout header="Расписание">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-80 w-full" />
      </MainLayout>
    );
  }

  const title = `Расписание${tournament?.name ? ' · ' + tournament.name : ''}`;

  return (
    <MainLayout header={title}>
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
        <Link href={`/tournaments/${id}`} className="text-brand-600 dark:text-brand-400 underline text-sm">
          ← К турниру
        </Link>
        <span className="text-xs text-content-muted">
          {matches.length} {pluralMatches(matches.length)} всего
        </span>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-16 text-content-muted">
          <FaCalendarAlt className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>Матчи ещё не запланированы</p>
          <p className="text-xs mt-1">Назначьте даты и корты матчам в редакторе сетки</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          {/* Календарь */}
          <div className="rounded-xl border border-surface-border bg-surface-card p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <Button variant="ghost" size="sm" onClick={prevMonth} aria-label="Предыдущий месяц">
                <FaChevronLeft />
              </Button>
              <div className="font-bold text-content">
                {MONTHS[viewMonth]} {viewYear}
              </div>
              <Button variant="ghost" size="sm" onClick={nextMonth} aria-label="Следующий месяц">
                <FaChevronRight />
              </Button>
            </div>

            {/* Заголовки дней недели */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((wd) => (
                <div key={wd} className="text-center text-[0.65rem] font-semibold text-content-muted uppercase py-1">
                  {wd}
                </div>
              ))}
            </div>

            {/* Сетка дней */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((d, i) => {
                if (!d) return <div key={i} />;
                const key = dayKey(d);
                const dayMatches = matchesByDay.get(key) || [];
                const has = dayMatches.length > 0;
                const isSelected = selectedDay === key;
                const isToday = dayKey(new Date()) === key;
                return (
                  <button
                    key={i}
                    onClick={() => has && setSelectedDay(isSelected ? null : key)}
                    disabled={!has}
                    className={cx(
                      'relative aspect-square rounded-lg border text-sm transition-colors flex flex-col items-center justify-center',
                      has
                        ? 'cursor-pointer hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20'
                        : 'cursor-default opacity-40',
                      isSelected
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 ring-1 ring-brand-400'
                        : 'border-surface-border',
                      isToday && !isSelected && 'ring-1 ring-court-400',
                    )}
                  >
                    <span className={cx('font-medium', has ? 'text-content' : 'text-content-muted')}>
                      {d.getDate()}
                    </span>
                    {has && (
                      <span className="absolute bottom-1 text-[0.6rem] font-bold text-brand-600 dark:text-brand-400">
                        {dayMatches.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Быстрые переходы к дням с матчами */}
            {daysWithMatches.length > 0 && (
              <div className="mt-4 pt-3 border-t border-surface-border">
                <div className="text-xs text-content-muted mb-2">Дни с играми:</div>
                <div className="flex flex-wrap gap-1.5">
                  {daysWithMatches.map((key) => {
                    const d = new Date(key);
                    const cnt = (matchesByDay.get(key) || []).length;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setSelectedDay(key);
                          setViewYear(d.getFullYear());
                          setViewMonth(d.getMonth());
                        }}
                        className={cx(
                          'px-2 py-1 rounded text-xs border transition-colors',
                          selectedDay === key
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-semibold'
                            : 'border-surface-border hover:border-brand-400 text-content',
                        )}
                      >
                        {d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                        <span className="ml-1 text-content-muted">{cnt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Список матчей выбранного дня */}
          <div className="rounded-xl border border-surface-border bg-surface-card p-3 sm:p-4">
            {selectedDay ? (
              <>
                <div className="font-bold text-content mb-3">
                  {new Date(selectedDay).toLocaleDateString('ru-RU', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </div>
                {selectedMatches.length === 0 ? (
                  <p className="text-sm text-content-muted">Нет матчей</p>
                ) : (
                  <div className="space-y-2">
                    {selectedMatches.map((m) => (
                      <ScheduleMatchCard key={String(m._id)} match={m} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-content-muted">
                <FaCalendarAlt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Выберите день в календаре</p>
                <p className="text-xs mt-1">чтобы увидеть матчи</p>
              </div>
            )}
          </div>
        </div>
      )}
    </MainLayout>
  );
}

function pluralMatches(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'матч';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'матча';
  return 'матчей';
}

function ScheduleMatchCard({ match }: { match: Match }) {
  const p1 = match.player1;
  const p2 = match.player2;
  const time = match.scheduledAt
    ? new Date(match.scheduledAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null;
  const refereeNames = (match.judgedBy || [])
    .map((j) => typeof j === 'object' ? [j.firstName, j.lastName].filter(Boolean).join(' ').trim() || j.email : null)
    .filter(Boolean);
  const ref = match.refereeId && typeof match.refereeId === 'object'
    ? [match.refereeId.firstName, match.refereeId.lastName].filter(Boolean).join(' ').trim() || match.refereeId.email
    : null;
  const judgeLabel = refereeNames.length > 0 ? refereeNames.join(', ') : ref;

  return (
    <Link
      href={`/m/${match._id}`}
      className="block rounded-lg border border-surface-border hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-colors p-2.5"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          {time && <span className="text-xs font-mono tabular-nums text-content-muted">{time}</span>}
          {match.status && <StatusBadge status={match.status} />}
        </div>
        {match.court && (
          <span className="text-[0.65rem] text-content-muted">🏟 {match.court}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <PlayerMini id={p1?._id} name={p1?.fullName} photoUrl={p1?.photoUrl} />
        <span className="text-[0.65rem] font-bold text-content-muted px-1">VS</span>
        <PlayerMini id={p2?._id} name={p2?.fullName} photoUrl={p2?.photoUrl} />
        <div className="ml-auto">
          <ScorePill score={match.score} compact />
        </div>
      </div>
      {judgeLabel && (
        <div className="mt-1.5 pt-1.5 border-t border-surface-border flex items-center gap-1 text-[0.65rem] text-content-muted">
          <span>🧑‍⚖️</span>
          <span className="truncate">Судья: {judgeLabel}</span>
        </div>
      )}
    </Link>
  );
}

function PlayerMini({ id, name, photoUrl }: { id?: string; name?: string; photoUrl?: string }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={getPlayerAvatarUrl(photoUrl)} alt={name || ''} className="w-6 h-6 rounded-full object-cover border border-surface-border" />
      ) : (
        <div className="w-6 h-6 rounded-full bg-surface-muted flex items-center justify-center text-xs">🎾</div>
      )}
      {id ? (
        <Link
          href={`/players/${id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-medium text-content truncate hover:text-brand-600 dark:hover:text-brand-400"
        >
          {name || '—'}
        </Link>
      ) : (
        <span className="text-sm font-medium text-content-muted truncate">{name || '—'}</span>
      )}
    </div>
  );
}
