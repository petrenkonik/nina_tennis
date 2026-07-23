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
 * Подсветка победителя, индикатор подачи, сторона корта.
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

  // Счёт по сетам из строки
  const sets = parseScore(match.score);
  const p1SetsWon = sets.filter((s) => s.p1Won).length;
  const p2SetsWon = sets.filter((s) => s.p2Won).length;
  const currentSet = sets[sets.length - 1];

  // Подача (по стороне корта)
  const serverLeft = isLive && match.serverSide === 'left';
  const serverRight = isLive && match.serverSide === 'right';

  // Сторона корта: по умолчанию player1 слева, player2 справа
  const p1Side = match.courtSide?.p1 ?? 'left';
  const leftIsP1 = p1Side === 'left';
  const leftPlayer = leftIsP1 ? p1 : p2;
  const rightPlayer = leftIsP1 ? p2 : p1;
  const leftWon = leftIsP1 ? p1Won : p2Won;
  const rightWon = leftIsP1 ? p2Won : p1Won;
  const leftSets = leftIsP1 ? p1SetsWon : p2SetsWon;
  const rightSets = leftIsP1 ? p2SetsWon : p1SetsWon;
  const leftServer = leftIsP1 ? serverLeft : serverRight;
  const rightServer = leftIsP1 ? serverRight : serverLeft;

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

      {/* Табло: 2 колонки */}
      <div className="grid grid-cols-2 flex-1">
        <ScoreboardSide
          player={leftPlayer}
          setsWon={leftSets}
          currentGames={currentSet ? (leftIsP1 ? currentSet.p1 : currentSet.p2) : undefined}
          isWinner={leftWon}
          isServer={leftServer}
          large={large}
          align="left"
        />
        <div className="border-l border-surface-border" />
        <ScoreboardSide
          player={rightPlayer}
          setsWon={rightSets}
          currentGames={currentSet ? (leftIsP1 ? currentSet.p2 : currentSet.p1) : undefined}
          isWinner={rightWon}
          isServer={rightServer}
          large={large}
          align="right"
        />
      </div>

      {/* Низ: счёт по сетам + корт */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-surface-border bg-surface-muted text-sm">
        <div className="flex items-center gap-3 font-mono tabular-nums">
          <span className={cx('font-bold', leftSets > rightSets && 'text-emerald-600')}>
            {leftSets}
          </span>
          <span className="text-content-muted">:</span>
          <span className={cx('font-bold', rightSets > leftSets && 'text-emerald-600')}>
            {rightSets}
          </span>
          <span className="text-content-muted text-xs">по сетам</span>
        </div>
        {match.court && (
          <span className="text-xs text-content-muted">🏟 {match.court}</span>
        )}
      </div>
    </div>
  );
}

interface SideProps {
  player?: { fullName?: string; photoUrl?: string; club?: string };
  setsWon: number;
  currentGames?: number;
  isWinner?: boolean;
  isServer?: boolean;
  large?: boolean;
  align: 'left' | 'right';
}

function ScoreboardSide({ player, setsWon, currentGames, isWinner, isServer, large, align }: SideProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-2 p-4 text-center transition-colors',
        isWinner && 'bg-emerald-50 dark:bg-emerald-900/20',
        align === 'right' && 'items-center',
      )}
    >
      {/* Аватар + индикатор подачи */}
      <div className="relative">
        {player?.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getPlayerAvatarUrl(player.photoUrl)}
            alt={player.fullName || ''}
            className={cx(
              'rounded-full border-2 object-cover',
              large ? 'w-24 h-24' : 'w-16 h-16',
              isWinner ? 'border-emerald-500' : 'border-surface-border',
            )}
          />
        ) : (
          <div className={cx('rounded-full bg-surface-muted flex items-center justify-center text-3xl', large ? 'w-24 h-24' : 'w-16 h-16')}>
            🎾
          </div>
        )}
        {isServer && (
          <span
            className={cx(
              'absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-court-500 text-surface text-xs font-bold px-2 py-0.5 shadow',
            )}
          >
            подача
          </span>
        )}
      </div>

      {/* Имя */}
      <div className={cx('font-bold text-content truncate w-full', large ? 'text-2xl' : 'text-base')}>
        {player?.fullName || '—'}
      </div>
      {player?.club && (
        <div className="text-xs text-content-muted truncate w-full">{player.club}</div>
      )}

      {/* Счёт крупно */}
      <div className="flex items-end gap-3 mt-1">
        <div className="text-center">
          <div className="text-[0.6rem] uppercase text-content-muted">сеты</div>
          <div className={cx('font-mono font-extrabold tabular-nums', large ? 'text-5xl' : 'text-3xl', isWinner && 'text-emerald-600')}>
            {setsWon}
          </div>
        </div>
        {typeof currentGames === 'number' && (
          <div className="text-center">
            <div className="text-[0.6rem] uppercase text-content-muted">геймы</div>
            <div className={cx('font-mono font-bold tabular-nums', large ? 'text-3xl' : 'text-xl', 'text-content')}>
              {currentGames}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
