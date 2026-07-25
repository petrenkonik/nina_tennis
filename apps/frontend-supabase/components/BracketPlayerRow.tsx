import React from 'react';
import { cx } from 'components/ui/cx';
import { SeedBadge } from 'components/ui/SeedBadge';
import { getPlayerAvatarUrl } from 'app/lib/avatar';

interface BracketPlayerRowProps {
  /** Полный объект игрока из бэкенда, либо разложенные поля (для BYE-слота). */
  player?: { _id?: string; fullName?: string; photoUrl?: string; club?: string; seed?: number; name?: string };
  fullName?: string;
  photoUrl?: string;
  club?: string;
  seed?: number;
  /** Этот игрок выиграл матч → подсветка. */
  isWinner?: boolean;
  /** Этот игрок подаёт → индикатор 🎾. */
  isServer?: boolean;
  /** Пока неизвестно, кто выиграл (матч идёт). */
  undecided?: boolean;
  compact?: boolean;
}

/**
 * Строка игрока в карточке матча сетки.
 * Аватар + имя + посев + индикатор подачи + подсветка победителя.
 */
export default function BracketPlayerRow({
  player,
  fullName,
  photoUrl,
  club,
  seed,
  isWinner,
  isServer,
  undecided,
  compact,
}: BracketPlayerRowProps) {
  const displayName = player?.fullName ?? fullName ?? (player?.name ? '—' : 'BYE');
  const displayPhoto = player?.photoUrl ?? photoUrl;
  const displayClub = player?.club ?? club;
  const displaySeed = player?.seed ?? seed;
  const isBye = !player?._id && !fullName;

  return (
    <div
      className={cx(
        'flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
        isWinner && 'bg-emerald-50 dark:bg-emerald-900/20',
        !isWinner && !undecided && !isBye && 'opacity-50',
        compact ? 'min-h-[1.75rem]' : 'min-h-[2.25rem]',
      )}
    >
      {/* Аватар */}
      <div className="relative shrink-0">
        {displayPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getPlayerAvatarUrl(displayPhoto)}
            alt={displayName}
            className={cx(
              'rounded-full border border-surface-border object-cover',
              compact ? 'w-6 h-6' : 'w-8 h-8',
            )}
          />
        ) : (
          <div
            className={cx(
              'rounded-full bg-surface-muted flex items-center justify-center text-content-muted',
              compact ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm',
            )}
          >
            {isBye ? '—' : '🎾'}
          </div>
        )}
        {/* Индикатор подачи */}
        {isServer && (
          <span
            className="absolute -top-1 -right-1 text-[0.6rem]"
            title="Подаёт"
          >
            🎾
          </span>
        )}
      </div>

      {/* Имя + клуб */}
      <div className="flex flex-col min-w-0 flex-1">
        <span
          className={cx(
            'truncate text-sm',
            isWinner ? 'font-bold text-content' : 'font-medium text-content',
            isBye && 'italic text-content-muted',
          )}
        >
          {displayName}
        </span>
        {displayClub && !compact && (
          <span className="text-[0.65rem] text-content-muted truncate">{displayClub}</span>
        )}
      </div>

      {/* Посев */}
      <SeedBadge seed={displaySeed} className="shrink-0" />
    </div>
  );
}
