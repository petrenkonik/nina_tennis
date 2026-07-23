import React from 'react';
import Link from 'next/link';
import { cx } from 'components/ui/cx';
import { ScorePill, StatusBadge } from 'components/ui';
import BracketPlayerRow from './BracketPlayerRow';

/** Игрок в матче: либо полный объект (с _id), либо BYE-слот {name:'BYE'}. */
export type BracketPlayer =
  | { _id: string; fullName?: string; photoUrl?: string; club?: string; seed?: number }
  | { name: 'BYE' }
  | null
  | undefined;

export interface BracketMatch {
  id: string;
  teams: [BracketPlayer, BracketPlayer];
  score?: string | null;
  scheduledAt?: string;
  playedAt?: string | null;
  /** id победителя (player._id), либо null. */
  winner?: string | null;
  court?: string;
  status?: string;
  /** Кому подаёт: 'left' | 'right' | null (для live-матчей). */
  serverSide?: 'left' | 'right' | null;
}

export interface MatchCardProps {
  match: BracketMatch;
  /** Раунд (0-индекс) — влияет на отступы. */
  roundIndex?: number;
  /** Ссылка при клике на карточку. */
  href?: string;
  compact?: boolean;
  /** Показывать соединительную линию справа (к следующему раунду). */
  connector?: 'right' | 'none';
}

function playerId(p: BracketPlayer): string | undefined {
  if (p && '_id' in p) return String(p._id);
  return undefined;
}

export default function MatchCard({
  match,
  href,
  compact,
  connector = 'none',
}: MatchCardProps) {
  const p1 = match.teams?.[0];
  const p2 = match.teams?.[1];
  const winnerId = match.winner ? String(match.winner) : undefined;
  const p1Id = playerId(p1);
  const p2Id = playerId(p2);
  const hasWinner = Boolean(winnerId);
  const p1Won = hasWinner && p1Id === winnerId;
  const p2Won = hasWinner && p2Id === winnerId;
  const isLive = match.status === 'in_progress';
  const serverLeft = isLive && match.serverSide === 'left';
  const serverRight = isLive && match.serverSide === 'right';

  const inner = (
    <div
      className={cx(
        'relative rounded-lg border bg-surface-card shadow-sm transition-all',
        'border-surface-border hover:border-brand-400 hover:shadow-md',
        isLive && 'border-live/60 ring-1 ring-live/30',
        compact ? 'w-[200px]' : 'w-[240px]',
      )}
    >
      {/* Статус + корт (шапка) */}
      <div className="flex items-center justify-between gap-1 px-2 py-1 border-b border-surface-border bg-surface-muted/50 rounded-t-lg">
        {match.status ? (
          <StatusBadge status={match.status} />
        ) : (
          <span className="text-[0.65rem] text-content-muted">Раунд</span>
        )}
        {match.court && (
          <span className="text-[0.65rem] text-content-muted truncate max-w-[80px]">
            {match.court}
          </span>
        )}
      </div>

      {/* Игроки */}
      <div className="p-1.5 space-y-1">
        <BracketPlayerRow
          player={p1 as any}
          isWinner={p1Won}
          isServer={serverLeft}
          undecided={!hasWinner}
          compact={compact}
        />
        <BracketPlayerRow
          player={p2 as any}
          isWinner={p2Won}
          isServer={serverRight}
          undecided={!hasWinner}
          compact={compact}
        />
      </div>

      {/* Счёт по сетам */}
      <div className="px-2 py-1.5 border-t border-surface-border flex items-center justify-between gap-2">
        <ScorePill score={match.score} compact />
        {(match.scheduledAt || match.playedAt) && (
          <span className="text-[0.6rem] text-content-muted tabular-nums">
            {new Date(match.playedAt || match.scheduledAt || '').toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        )}
      </div>

      {/* Соединительная линия справа к следующему раунду */}
      {connector === 'right' && (
        <span className="hidden md:block absolute top-1/2 -right-4 w-4 h-px bg-surface-border" />
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}
