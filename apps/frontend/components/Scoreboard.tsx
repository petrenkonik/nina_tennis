import React from 'react';
import { cx } from 'components/ui/cx';
import { StatusBadge } from 'components/ui';
import { parseScore } from 'components/ui/ScorePill';
import { getPlayerAvatarUrl } from 'app/lib/api';
import type { Match } from '@shared/models/tennis';

export interface ScoreboardProps {
  match: Match | null | undefined;
  /** Заголовок турнира/группы сверху. */
  context?: { tournamentName?: string; groupName?: string };
  /** Крупный размер (для ТВ/планшета). */
  large?: boolean;
}

/**
 * Табло матча — крупный двусторонний счёт, читается с расстояния.
 * Переиспользуется на public scoreboard и в панели судьи (предпросмотр).
 *
 * Источник данных — match.scoringState (полное состояние судейства,
 * сохраняется автосейвом). Если его нет — парсим строку match.score.
 * Счёт каждого игрока (сеты/геймы/очки) — в правой колонке.
 * Подающий помечен иконкой 🎾 рядом с именем.
 */
export default function Scoreboard({ match, context, large }: ScoreboardProps) {
  if (!match) {
    return (
      <div className="flex items-center justify-center h-full text-content-muted p-8">
        Матч не найден
      </div>
    );
  }

  const p1 = match.player1;
  const p2 = match.player2;
  const winnerId = match.winnerId ? String(match.winnerId) : undefined;
  const p1Won = Boolean(winnerId && p1?._id && String(p1._id) === winnerId);
  const p2Won = Boolean(winnerId && p2?._id && String(p2._id) === winnerId);
  const isLive = match.status === 'in_progress';

  // Богатый источник данных — scoringState (сохраняется автосейвом).
  const st = match.scoringState;
  // Сеты по строке (fallback, если scoringState отсутствует).
  const sets = parseScore(match.score);
  const p1SetsWon = st ? st.sets[0] : sets.filter((s) => s.p1Won).length;
  const p2SetsWon = st ? st.sets[1] : sets.filter((s) => s.p2Won).length;

  // Очки текущего гейма (0/15/30/40/AD) — только из scoringState.
  const p1Points = st ? (st.isTiebreak ? String(st.tiebreakPoints[0]) : st.points[0]) : null;
  const p2Points = st ? (st.isTiebreak ? String(st.tiebreakPoints[1]) : st.points[1]) : null;

  // Геймы текущего сета.
  const curGames = st?.games?.[st.currentSet - 1];
  const p1Games = st ? curGames?.[0] ?? 0 : sets[sets.length - 1]?.p1 ?? 0;
  const p2Games = st ? curGames?.[1] ?? 0 : sets[sets.length - 1]?.p2 ?? 0;

  // Подача: serverSide — сторона корта ('left'|'right').
  const serverLeft = isLive && match.serverSide === 'left';
  const serverRight = isLive && match.serverSide === 'right';

  // Сторона корта: по умолчанию player1 слева, player2 справа.
  const p1Side = match.courtSide?.p1 ?? 'left';
  const leftIsP1 = p1Side === 'left';

  const topPlayer = leftIsP1 ? p1 : p2;
  const bottomPlayer = leftIsP1 ? p2 : p1;
  const topWon = leftIsP1 ? p1Won : p2Won;
  const bottomWon = leftIsP1 ? p2Won : p1Won;
  const topSets = leftIsP1 ? p1SetsWon : p2SetsWon;
  const bottomSets = leftIsP1 ? p2SetsWon : p1SetsWon;
  const topGames = leftIsP1 ? p1Games : p2Games;
  const bottomGames = leftIsP1 ? p2Games : p1Games;
  const topPoints = leftIsP1 ? p1Points : p2Points;
  const bottomPoints = leftIsP1 ? p2Points : p1Points;
  const topServer = leftIsP1 ? serverLeft : serverRight;
  const bottomServer = leftIsP1 ? serverRight : serverLeft;

  return (
    <div className={cx('flex flex-col h-full w-full bg-surface-card rounded-2xl overflow-hidden shadow-lg')}>
      {/* Шапка: турнир / группа / статус */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-surface-border bg-surface-muted">
        <div className="min-w-0">
          {context?.tournamentName && (
            <div className="font-bold text-content truncate">{context.tournamentName}</div>
          )}
          {context?.groupName && (
            <div className="text-xs text-content-muted truncate">{context.groupName}</div>
          )}
        </div>
        <StatusBadge status={match.status || 'scheduled'} />
      </div>

      {/* Табло: 2 строки (игроки) + счёт справа */}
      <div className="flex-1 flex flex-col">
        <PlayerRow
          player={topPlayer}
          setsWon={topSets}
          games={topGames}
          points={topPoints}
          isWinner={topWon}
          isServer={topServer}
          large={large}
          isTiebreak={Boolean(st?.isTiebreak)}
        />
        <div className="h-px bg-surface-border" />
        <PlayerRow
          player={bottomPlayer}
          setsWon={bottomSets}
          games={bottomGames}
          points={bottomPoints}
          isWinner={bottomWon}
          isServer={bottomServer}
          large={large}
          isTiebreak={Boolean(st?.isTiebreak)}
        />
      </div>

      {/* Низ: корт + статус сета */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-surface-border bg-surface-muted text-sm">
        <div className="flex items-center gap-2">
          {st?.isTiebreak && (
            <span className="text-xs font-semibold text-court-700 dark:text-court-300">
              ⚡ Тай-брейк
            </span>
          )}
          {st && (
            <span className="text-xs text-content-muted">сет {st.currentSet}</span>
          )}
        </div>
        {match.court && (
          <span className="text-xs text-content-muted">🏟 {match.court}</span>
        )}
      </div>
    </div>
  );
}

interface PlayerRowProps {
  player?: { fullName?: string; photoUrl?: string; club?: string };
  setsWon: number;
  games: number;
  points: string | null;
  isWinner?: boolean;
  isServer?: boolean;
  large?: boolean;
  isTiebreak?: boolean;
}

function PlayerRow({ player, setsWon, games, points, isWinner, isServer, large, isTiebreak }: PlayerRowProps) {
  return (
    <div
      className={cx(
        'flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 transition-colors flex-1',
        isWinner && 'bg-emerald-50 dark:bg-emerald-900/20',
      )}
    >
      {/* Аватар */}
      <div className="shrink-0">
        {player?.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getPlayerAvatarUrl(player.photoUrl)}
            alt={player.fullName || ''}
            className={cx(
              'rounded-full border-2 object-cover',
              large ? 'w-16 h-16' : 'w-12 h-12',
              isWinner ? 'border-emerald-500' : 'border-surface-border',
            )}
          />
        ) : (
          <div className={cx('rounded-full bg-surface-muted flex items-center justify-center text-2xl', large ? 'w-16 h-16' : 'w-12 h-12')}>
            🎾
          </div>
        )}
      </div>

      {/* Имя + иконка подачи + (под именем) сеты/геймы */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {isServer && (
          <span
            className={cx(
              'shrink-0 inline-flex items-center justify-center rounded-full bg-court-500 text-surface shadow',
              large ? 'w-10 h-10 text-xl' : 'w-7 h-7 text-base',
            )}
            title="Подаёт"
            aria-label="Подаёт"
          >
            🎾
          </span>
        )}
        <div className="min-w-0">
          <div className={cx('font-bold text-content truncate', large ? 'text-2xl' : 'text-base sm:text-lg')}>
            {player?.fullName || '—'}
          </div>
          {/* Сеты / геймы — под именем, компактно */}
          <div className="flex items-center gap-3 font-mono tabular-nums text-content-muted">
            <span className="text-xs">
              сеты <span className={cx('font-bold', isWinner && 'text-emerald-600 dark:text-emerald-400')}>{setsWon}</span>
            </span>
            <span className="text-xs">
              геймы <span className="font-bold text-content">{games}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Очки текущего гейма — справа, крупно */}
      <div className="font-mono tabular-nums shrink-0 text-right">
        {points !== null ? (
          <>
            <div className="text-[0.6rem] uppercase text-content-muted leading-tight">
              {isTiebreak ? 'тай-брейк' : 'очки'}
            </div>
            <div
              className={cx(
                'font-extrabold tabular-nums leading-none text-content',
                large ? 'text-6xl' : 'text-4xl sm:text-5xl',
              )}
            >
              {points}
            </div>
          </>
        ) : (
          <>
            <div className="text-[0.6rem] uppercase text-content-muted leading-tight">сеты</div>
            <div
              className={cx(
                'font-extrabold tabular-nums leading-none',
                large ? 'text-6xl' : 'text-4xl sm:text-5xl',
                isWinner ? 'text-emerald-600 dark:text-emerald-400' : 'text-content',
              )}
            >
              {setsWon}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
