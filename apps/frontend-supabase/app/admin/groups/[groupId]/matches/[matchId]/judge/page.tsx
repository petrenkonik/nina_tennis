"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getGroupById,
  getGroupMatches,
  updateMatch,
} from 'app/lib/client';
import { Button, StatusBadge } from 'components/ui';
import Scoreboard from 'components/Scoreboard';
import {
  createInitialScoringState,
  addPoint,
  formatScore,
  setsNeededToWin,
  type MatchScoringState,
  type Side,
} from '@shared/scoring';
import type { Match } from '@shared/models/tennis';

type CourtSide = 'left' | 'right';

export default function JudgeMatchPage() {
  const params = useParams();
  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  const matchId = Array.isArray(params.matchId) ? params.matchId[0] : params.matchId;
      const [match, setMatch] = useState<Match | null>(null);
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [scoring, setScoring] = useState<MatchScoringState>(() => createInitialScoringState(3));
  const [history, setHistory] = useState<Side[]>([]);
  const [serverSide, setServerSide] = useState<CourtSide | null>(null);
  const [courtSide, setCourtSide] = useState<{ p1: CourtSide; p2: CourtSide }>({ p1: 'left', p2: 'right' });
  const [confirmFinish, setConfirmFinish] = useState(false);

  const loadedRef = useRef(false);

  const loadMatch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const g = await getGroupById(groupId);
      setGroup(g);
      const matches = await getGroupMatches(groupId);
      const found = matches.find((m: any) => String(m._id) === String(matchId));
      if (!found) throw new Error('Матч не найден');
      const m = { ...found, groupId } as Match;
      setMatch(m);
      setServerSide(m.serverSide ?? null);
      setCourtSide(m.courtSide ?? { p1: 'left', p2: 'right' });
      // Восстанавливаем сохранённое состояние судейства (после рефреша).
      if (m.scoringState) {
        setScoring(m.scoringState);
        setHistory((m.pointHistory ?? []) as Side[]);
      } else {
        setScoring(createInitialScoringState(3));
        setHistory([]);
      }
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки матча');
    } finally {
      setLoading(false);
      loadedRef.current = true;
    }
  }, [groupId, matchId]);

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  const player1 = match?.player1;
  const player2 = match?.player2;

  const matchOver = useMemo(() => {
    const needed = setsNeededToWin(scoring);
    return scoring.sets[0] >= needed || scoring.sets[1] >= needed;
  }, [scoring]);
  const winnerSide: Side | null = matchOver
    ? scoring.sets[0] > scoring.sets[1] ? 1 : 2
    : null;

  // Подача выбирается судьёй вручную с верхней панели — не трогаем её при очке.
  const handlePoint = useCallback((side: Side) => {
    if (matchOver || saving) return;
    setSaved(false);
    const result = addPoint(scoring, side);
    setScoring(result.state);
    setHistory((h) => [...h, side]);
  }, [scoring, matchOver, saving]);

  const handleUndo = useCallback(() => {
    if (history.length === 0 || saving) return;
    setSaved(false);
    const next = history.slice(0, -1);
    setHistory(next);
    const start = createInitialScoringState(scoring.bestOf, scoring.gamesPerSet, scoring.tiebreakAtDeuce);
    let s = start;
    for (const side of next) s = addPoint(s, side).state;
    setScoring(s);
  }, [history, scoring, saving]);

  const handleReset = useCallback(() => {
    setSaved(false);
    setHistory([]);
    setScoring(createInitialScoringState(scoring.bestOf, scoring.gamesPerSet, scoring.tiebreakAtDeuce));
    setServerSide(null);
  }, [scoring]);

  // Быстрые клавиши
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === '1') { e.preventDefault(); handlePoint(1); }
      else if (e.key === '2') { e.preventDefault(); handlePoint(2); }
      else if (e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); }
      else if (e.key.toLowerCase() === 'f' && matchOver) { e.preventDefault(); setConfirmFinish(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePoint, handleUndo, matchOver]);

  const persist = useCallback(async (status: 'scheduled' | 'in_progress' | 'finished' | 'canceled') => {
    if (!match) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      const winnerId = winnerSide === 1 ? player1?._id : winnerSide === 2 ? player2?._id : null;
      const scoreStr = history.length > 0 ? formatScore(scoring) : match.score;
      const payload: any = {
        status,
        score: scoreStr || '',
        court: match.court || '',
        round: match.round ?? 1,
        player1: player1?._id || null,
        player2: player2?._id || null,
        serverSide,
        courtSide,
        scoringState: scoring,
        pointHistory: history,
      };
      if (winnerId) payload.winnerId = winnerId;
      if (match.scheduledAt) payload.scheduledAt = new Date(match.scheduledAt).toISOString();
      if (status === 'finished' && winnerId) payload.playedAt = new Date().toISOString();

      const updated = await updateMatch(groupId, matchId, payload);
      setMatch({ ...match, ...updated, player1, player2, groupId } as Match);
      setSaved(true);
      setConfirmFinish(false);
    } catch (e: any) {
      setError(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }, [match, groupId, matchId, winnerSide, player1, player2, history, scoring, serverSide, courtSide]);

  // Автосохранение состояния (с дебаунсом): чтобы зритель на /m/:id видел очки
  // в реальном времени, а рефреш страницы судьи не сбрасывал счёт.
  // Эффект зависит только от изменений судейства (не от match!), чтобы не зациклиться:
  // save → setMatch → новый match НЕ перезапускает этот эффект.
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveToken = useRef(0);
  const matchRef = useRef<Match | null>(null);
  matchRef.current = match;
  useEffect(() => {
    // Не автосохраняем до первой загрузки матча.
    if (!loadedRef.current || !matchRef.current) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    const myToken = ++autosaveToken.current;
    autosaveTimer.current = setTimeout(async () => {
      const m = matchRef.current;
      if (!m) return;
      // Завершённый/отменённый матч не трогаем автосейвом.
      if (m.status === 'finished' || m.status === 'canceled') return;
      const scoreStr = history.length > 0 ? formatScore(scoring) : '';
      const winnerId = winnerSide === 1 ? player1?._id : winnerSide === 2 ? player2?._id : null;
      const payload: any = {
        status: matchOver ? 'finished' : 'in_progress',
        score: scoreStr,
        court: m.court || '',
        round: m.round ?? 1,
        player1: player1?._id || null,
        player2: player2?._id || null,
        serverSide,
        courtSide,
        scoringState: scoring,
        pointHistory: history,
      };
      if (winnerId) {
        payload.winnerId = winnerId;
        if (matchOver) payload.playedAt = new Date().toISOString();
      }
      try {
        const updated = await updateMatch(groupId, matchId, payload);
        if (myToken === autosaveToken.current) {
          setMatch({ ...m, ...updated, player1, player2, groupId } as Match);
          setSaved(true);
        }
      } catch (e: any) {
        if (myToken === autosaveToken.current) {
          setError(e.message || 'Ошибка автосохранения');
        }
      }
    }, 1200);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoring, history, serverSide, courtSide]);

  // Напоминание о смене сторон: после нечётного общего числа геймов в текущем сете
  const currentSetGames = scoring.games[scoring.currentSet - 1];
  const totalGamesCurrentSet = currentSetGames ? currentSetGames[0] + currentSetGames[1] : 0;
  const showSideSwapHint = !matchOver && !scoring.isTiebreak && totalGamesCurrentSet > 0 && totalGamesCurrentSet % 2 === 1;

  // Предпросмотр матча для Scoreboard (объединяем scoring → score-строку)
  const previewMatch = useMemo((): Match | null => {
    if (!match) return null;
    return {
      ...match,
      score: history.length > 0 ? formatScore(scoring) : match.score,
      status: matchOver ? 'finished' : (history.length > 0 ? 'in_progress' : match.status),
      winnerId: winnerSide === 1 ? player1?._id : winnerSide === 2 ? player2?._id : match.winnerId,
      serverSide,
      courtSide,
    } as Match;
  }, [match, history, scoring, matchOver, winnerSide, player1, player2, serverSide, courtSide]);

  if (loading) {
    return <Shell>Загрузка…</Shell>;
  }
  if (error && !match) {
    return (
      <Shell>
        <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 rounded mb-4 text-sm">{error}</div>
        <Link href={`/admin/groups/${groupId}/bracket`} className="text-brand-600 dark:text-brand-400 underline">← Назад к матчам</Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <Link href={`/admin/groups/${groupId}/bracket`} className="text-brand-600 dark:text-brand-400 underline text-sm">
          ← К матчам группы
        </Link>
        <Link
          href={`/m/${matchId}`}
          target="_blank"
          className="text-xs text-content-muted hover:text-content"
        >
          📺 Открыть публичное табло →
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h1 className="text-xl font-extrabold">Судейство</h1>
        {match?.status && <StatusBadge status={match.status} />}
        {group && <span className="text-sm text-content-muted">{group.name}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Левая колонка: управление */}
        <div className="space-y-3">
          {/* Настройки матча */}
          <div className="rounded-xl border border-surface-border bg-surface-card p-3 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-sm text-content-muted">Формат:</label>
              <select
                className="border border-surface-border rounded px-2 py-1 text-sm bg-surface-card text-content"
                value={scoring.bestOf}
                onChange={(e) => {
                  setScoring(createInitialScoringState(Number(e.target.value)));
                  setHistory([]);
                }}
                disabled={history.length > 0 || saving}
              >
                <option value={3}>best of 3</option>
                <option value={5}>best of 5</option>
                <option value={1}>1 сет</option>
              </select>
            </div>

            {/* Подача */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-content-muted">Подаёт:</span>
              <Button
                size="sm"
                variant={serverSide === 'left' ? 'primary' : 'outline'}
                onClick={() => setServerSide(serverSide === 'left' ? null : 'left')}
              >
                🎾 {courtSide.p1 === 'left' ? player1?.fullName : player2?.fullName}
              </Button>
              <Button
                size="sm"
                variant={serverSide === 'right' ? 'primary' : 'outline'}
                onClick={() => setServerSide(serverSide === 'right' ? null : 'right')}
              >
                🎾 {courtSide.p1 === 'right' ? player1?.fullName : player2?.fullName}
              </Button>
            </div>

            {/* Сторона корта */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-content-muted">Сторона корта:</span>
              <Button
                size="sm"
                variant={courtSide.p1 === 'left' ? 'secondary' : 'outline'}
                onClick={() => setCourtSide({ p1: 'left', p2: 'right' })}
                disabled={history.length > 0}
              >
                {player1?.fullName} слева
              </Button>
              <Button
                size="sm"
                variant={courtSide.p1 === 'right' ? 'secondary' : 'outline'}
                onClick={() => setCourtSide({ p1: 'right', p2: 'left' })}
                disabled={history.length > 0}
              >
                {player1?.fullName} справа
              </Button>
            </div>
          </div>

          {/* Напоминание о смене сторон */}
          {showSideSwapHint && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 px-3 py-2 text-sm flex items-center gap-2">
              ↔️ Нечётный гейм — игрокам сменить стороны
            </div>
          )}

          {/* Кнопки очков */}
          <div className="grid grid-cols-2 gap-3">
            <PointButton
              name={player1?.fullName || 'Игрок 1'}
              photoUrl={player1?.photoUrl}
              sets={scoring.sets[0]}
              games={currentSetGames?.[0] ?? 0}
              points={scoring.isTiebreak ? String(scoring.tiebreakPoints[0]) : scoring.points[0]}
              isServer={serverSide === (courtSide.p1 === 'left' ? 'left' : 'right')}
              disabled={matchOver || saving}
              onClick={() => handlePoint(1)}
            />
            <PointButton
              name={player2?.fullName || 'Игрок 2'}
              photoUrl={player2?.photoUrl}
              sets={scoring.sets[1]}
              games={currentSetGames?.[1] ?? 0}
              points={scoring.isTiebreak ? String(scoring.tiebreakPoints[1]) : scoring.points[1]}
              isServer={serverSide === (courtSide.p1 === 'right' ? 'left' : 'right')}
              disabled={matchOver || saving}
              onClick={() => handlePoint(2)}
            />
          </div>

          {scoring.isTiebreak && !matchOver && (
            <div className="rounded-lg border border-court-300 bg-court-50 dark:bg-court-900/20 text-court-700 dark:text-court-300 px-3 py-2 text-sm text-center">
              Тай-брейк: до 7 очков с разницей в 2
            </div>
          )}

          {/* Счёт по сетам */}
          <div className="rounded-lg border border-surface-border bg-surface-muted px-3 py-2 text-center font-mono tabular-nums">
            <span className="text-sm text-content-muted mr-2">Счёт:</span>
            <span className="text-lg font-bold">{formatScore(scoring) || '—'}</span>
            <span className="text-xs text-content-muted ml-2">| сет {scoring.currentSet}</span>
          </div>

          {/* Действия */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleUndo} disabled={history.length === 0 || saving}>
              ↶ Отменить (Z)
            </Button>
            <Button variant="ghost" onClick={handleReset} disabled={history.length === 0 || saving}>
              ⟲ Сбросить
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" onClick={() => persist('in_progress')} disabled={saving || matchOver}>
              Сохранить (идёт)
            </Button>
            <Button
              variant="success"
              onClick={() => setConfirmFinish(true)}
              disabled={saving || !matchOver}
            >
              Завершить (F)
            </Button>
            <Button variant="danger" onClick={() => persist('canceled')} disabled={saving}>
              Отменить матч
            </Button>
          </div>

          {saving && <div className="text-blue-600 dark:text-blue-400 text-sm text-center">Сохранение…</div>}
          {saved && <div className="text-emerald-600 dark:text-emerald-400 text-sm text-center">Сохранено ✓</div>}
          {error && <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">{error}</div>}

          {/* Подсказка по клавишам */}
          <div className="text-xs text-content-muted text-center">
            Горячие клавиши: <kbd className="px-1 bg-surface-muted rounded">1</kbd>/<kbd className="px-1 bg-surface-muted rounded">2</kbd> очко · <kbd className="px-1 bg-surface-muted rounded">Z</kbd> отменить · <kbd className="px-1 bg-surface-muted rounded">F</kbd> завершить
          </div>
        </div>

        {/* Правая колонка: live-предпросмотр */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-content-muted uppercase tracking-wide">Вид для зрителей</div>
          <div style={{ height: '420px' }}>
            <Scoreboard match={previewMatch} context={{ groupName: group?.name }} />
          </div>
        </div>
      </div>

      {/* Модалка подтверждения завершения */}
      {confirmFinish && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h2 className="text-lg font-bold mb-2">Завершить матч?</h2>
            <p className="text-sm text-content-muted mb-4">
              Победитель:{' '}
              <span className="font-semibold text-content">
                {winnerSide === 1 ? player1?.fullName : player2?.fullName}
              </span>
            </p>
            <div className="rounded-lg bg-surface-muted px-3 py-2 mb-4 font-mono text-sm">
              {formatScore(scoring)}
            </div>
            <div className="flex gap-2">
              <Button variant="success" className="flex-1" onClick={() => persist('finished')} disabled={saving}>
                Да, завершить
              </Button>
              <Button variant="outline" onClick={() => setConfirmFinish(false)} disabled={saving}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="max-w-5xl mx-auto py-6 px-4 pb-24">
      {children}
    </main>
  );
}

function PointButton({
  name,
  photoUrl,
  sets,
  games,
  points,
  isServer,
  disabled,
  onClick,
}: {
  name: string;
  photoUrl?: string;
  sets: number;
  games: number;
  points: string;
  isServer: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="relative rounded-xl border-2 border-surface-border bg-surface-card hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors p-4 text-left disabled:opacity-40 disabled:pointer-events-none"
    >
      {isServer && (
        <span className="absolute top-2 right-2 text-xs bg-court-500 text-surface rounded-full px-2 py-0.5 font-bold">
          🎾 подача
        </span>
      )}
      <div className="flex items-center gap-2 mb-2">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name} className="w-10 h-10 rounded-full object-cover border" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-surface-muted flex items-center justify-center text-xl">🎾</div>
        )}
        <span className="font-bold text-sm truncate">{name}</span>
      </div>
      <div className="flex items-end gap-3 font-mono tabular-nums">
        <div>
          <div className="text-[0.6rem] text-content-muted uppercase">сеты</div>
          <div className="text-xl font-bold">{sets}</div>
        </div>
        <div>
          <div className="text-[0.6rem] text-content-muted uppercase">геймы</div>
          <div className="text-lg">{games}</div>
        </div>
        <div className="ml-auto text-center">
          <div className="text-[0.6rem] text-content-muted uppercase">очки</div>
          <div className="text-3xl font-extrabold">{points}</div>
        </div>
      </div>
    </button>
  );
}
