import React from 'react';
import Link from 'next/link';
import { cx } from 'components/ui/cx';
import { ScorePill, StatusBadge } from 'components/ui';
import BracketPlayerRow from './BracketPlayerRow';

/** Игрок в матче: либо полный объект (с _id), либо BYE-слот {name:'BYE'},
 *  либо feeder-слот {name:'TBD'} — «Победитель матча #N (ожидается)». */
export type BracketPlayer =
  | { _id: string; fullName?: string; photoUrl?: string; club?: string; seed?: number; partner?: { _id: string; fullName?: string; photoUrl?: string; club?: string } }
  | { name: 'BYE' }
  | { name: 'TBD'; fullName?: string; feederMatchId?: string; feederLabel?: string }
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
  /** Текущий судья (populate User) или null. */
  refereeId?: { _id: string; firstName?: string; lastName?: string; email?: string } | string | null;
  /** История судей (populate User). */
  judgedBy?: Array<{ _id: string; firstName?: string; lastName?: string; email?: string } | string>;
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

/** Признак «соперник не определён» (TBD) — слот без игрока в раунде ≥ 1. */
function isByeSlot(p: BracketPlayer): boolean {
  return !p || ('name' in p && p.name === 'BYE') || !('_id' in p && p._id);
}

export type MatchType = 'finished' | 'in_progress' | 'scheduled' | 'tbd' | 'canceled';

/**
 * Классифицирует матч по цветотипу сетки.
 * TBD: раунд ≥ 1 (roundIndex), где хотя бы один слот — «ждёт победителя» (bye/null).
 * Настоящий bye возможен только в первом раунде и считается scheduled.
 */
export function getMatchType(match: BracketMatch, roundIndex?: number): MatchType {
  if (match.status === 'canceled') return 'canceled';
  if (match.status === 'finished') return 'finished';
  if (match.status === 'in_progress') return 'in_progress';
  // Раунды 2+ с незаполненным слотом → соперник ещё не определён (TBD).
  if ((roundIndex ?? 0) >= 1 && (isByeSlot(match.teams?.[0]) || isByeSlot(match.teams?.[1]))) {
    return 'tbd';
  }
  return 'scheduled';
}

/** Класс рамки карточки для каждого типа матча. */
export const MATCH_BORDER: Record<MatchType, string> = {
  finished: 'border-emerald-400/70 hover:border-emerald-400',
  in_progress: 'border-live/60 ring-1 ring-live/30',
  scheduled: 'border-blue-400/70 hover:border-blue-400',
  tbd: 'border-dashed border-content-muted/50 hover:border-content-muted',
  canceled: 'border-surface-border opacity-60',
};

export default function MatchCard({
  match,
  roundIndex,
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

  const matchType = getMatchType(match, roundIndex);
  const isTbd = matchType === 'tbd';
  // Цвет рамки по типу матча (единый источник правды для сетки и легенды).
  const borderClass = MATCH_BORDER[matchType];

  // Судья матча (отображаем текущего; если есть история — всех).
  const referee = refereeName(match.refereeId);
  const allJudges = (match.judgedBy || []).map(refereeName).filter(Boolean);
  const judgesLabel = allJudges.length > 0
    ? `Судья: ${allJudges.join(', ')}`
    : (referee ? `Судья: ${referee}` : null);

  const inner = (
    <div
      className={cx(
        'relative rounded-lg border bg-surface-card shadow-sm transition-all',
        'hover:shadow-md',
        borderClass,
        compact ? 'w-[200px]' : 'w-[240px]',
      )}
    >
      {/* Статус + корт (шапка) */}
      <div className="flex items-center justify-between gap-1 px-2 py-1 border-b border-surface-border bg-surface-muted/50 rounded-t-lg">
        {isTbd ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-content-muted/15 px-2 py-0.5 text-[0.65rem] font-medium text-content-muted">
            ⏳ TBD · ожидается победитель
          </span>
        ) : match.status ? (
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
        <div className="space-y-0.5">
          <BracketPlayerRow
            player={p1 as any}
            isWinner={p1Won}
            isServer={serverLeft}
            undecided={!hasWinner}
            compact={compact}
            placeholder={isTbd ? 'Ожидается соперник' : undefined}
          />
          <PartnerRow partner={partnerOf(p1)} compact={compact} />
        </div>
        <div className="space-y-0.5">
          <BracketPlayerRow
            player={p2 as any}
            isWinner={p2Won}
            isServer={serverRight}
            undecided={!hasWinner}
            compact={compact}
            placeholder={isTbd ? 'Ожидается соперник' : undefined}
          />
          <PartnerRow partner={partnerOf(p2)} compact={compact} />
        </div>
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

      {/* Судья */}
      {judgesLabel && (
        <div className="px-2 py-1 border-t border-surface-border flex items-center gap-1 text-[0.6rem] text-content-muted bg-brand-50/40 dark:bg-brand-900/10">
          <span>🧑‍⚖️</span>
          <span className="truncate">{judgesLabel}</span>
        </div>
      )}

      {/* Соединительная линия справа к следующему раунду.
          Зелёная — если победитель уже определён (путь победителя). */}
      {connector === 'right' && (
        <span
          className={cx(
            'hidden md:block absolute top-1/2 -right-4 w-4 h-0.5 -translate-y-1/2',
            hasWinner ? 'bg-emerald-500' : 'bg-content-muted/40 dark:bg-content-muted/30',
          )}
        />
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

/** Извлекает партнёра из слота стороны (партнёр есть только в парных матчах). */
function partnerOf(p: BracketPlayer): { _id: string; fullName?: string; photoUrl?: string; club?: string } | undefined {
  if (p && '_id' in p && p.partner) return p.partner;
  return undefined;
}

/**
 * Компактная мини-строка партнёра стороны (для парных матчей).
 * Показывается под основным игроком стороны: «+ Имя».
 */
function PartnerRow({
  partner,
  compact,
}: {
  partner?: { _id: string; fullName?: string; photoUrl?: string; club?: string };
  compact?: boolean;
}) {
  if (!partner) return null;
  return (
    <div className={cx('flex items-center gap-1.5 pl-1', compact ? 'min-h-[1.25rem]' : 'min-h-[1.5rem]')}>
      <span className="text-content-muted text-[0.7rem]">+</span>
      {partner.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={partner.photoUrl}
          alt={partner.fullName || ''}
          className={cx('rounded-full border border-surface-border object-cover', compact ? 'w-4 h-4' : 'w-5 h-5')}
        />
      ) : (
        <div className={cx('rounded-full bg-surface-muted', compact ? 'w-4 h-4' : 'w-5 h-5')} />
      )}
      <span className="truncate text-xs text-content-muted flex-1">{partner.fullName}</span>
    </div>
  );
}

/** Извлекает читаемое имя судьи из populate-объекта или строки-id. */
function refereeName(r: BracketMatch['refereeId']): string | null {
  if (!r) return null;
  if (typeof r === 'string') return null; // только id, без populate — не показываем
  const name = [r.firstName, r.lastName].filter(Boolean).join(' ').trim();
  return name || r.email || null;
}
