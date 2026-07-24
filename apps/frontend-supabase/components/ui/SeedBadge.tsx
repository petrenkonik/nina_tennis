import React from 'react';
import { cx } from './cx';

/** Бейдж посева игрока: кружок #1 (1 — самый сильный). */
export function SeedBadge({ seed, className }: { seed?: number; className?: string }) {
  if (typeof seed !== 'number') return null;
  return (
    <span
      className={cx(
        'inline-flex items-center justify-center rounded-full bg-court-500/20 text-court-700 dark:text-court-300',
        'text-[0.65rem] font-bold px-1.5 py-0.5 min-w-[1.25rem]',
        className,
      )}
      title={`Посев #${seed}`}
    >
      {seed}
    </span>
  );
}
