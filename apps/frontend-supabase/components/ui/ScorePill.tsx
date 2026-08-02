import React from 'react';
import { cx } from './cx';
// parseScore/ParsedSet вынесены в shared — единый парсер для UI и подсчёта таблиц.
export { parseScore } from '@shared/score';
export type { ParsedSet } from '@shared/score';
import { parseScore } from '@shared/score';
import type { ParsedSet } from '@shared/score';

/**
 * «Таблетка» счёта по сетам. Выигранные игроком сеты — жирные/подсвеченные,
 * проигранные — приглушённые. Моноширинно, выровнено.
 *
 * @param score строка вида "6-4 3-6 7-5"
 * @param compact мини-вариант для карточек сетки
 */
export function ScorePill({
  score,
  compact = false,
  className,
}: {
  score?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const sets = parseScore(score);
  if (sets.length === 0) {
    return <span className={cx('text-content-muted text-xs', className)}>—</span>;
  }
  return (
    <div className={cx('inline-flex items-center gap-1 font-mono tabular-nums', className)}>
      {sets.map((set, i) => (
        <div
          key={i}
          className={cx(
            'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5',
            compact ? 'text-xs' : 'text-sm',
            'bg-surface-muted',
          )}
          title={`Сет ${i + 1}${set.tb != null ? ` · тай-брейк ${set.tb}` : ''}`}
        >
          <span className={cx(set.p1Won ? 'font-bold text-content' : 'text-content-muted')}>
            {set.p1}
          </span>
          <span className="text-content-muted">:</span>
          <span className={cx(set.p2Won ? 'font-bold text-content' : 'text-content-muted')}>
            {set.p2}
          </span>
        </div>
      ))}
    </div>
  );
}
