import React from 'react';
import { cx } from './cx';

/** Один сет из строки счёта: "6-4" → { p1: 6, p2: 4, p1Won, p2Won } */
interface ParsedSet {
  p1: number;
  p2: number;
  p1Won: boolean;
  p2Won: boolean;
  /** Счёт тай-брейка в скобках, если есть: "7-6(5)" → 5 */
  tb?: number;
}

/**
 * Разбирает строку счёта матча в массив сетов.
 * Принимает форматы: "6-4 3-6 7-5", "6-4 7-6(5)", "6:4 3:6".
 */
export function parseScore(score: string | null | undefined): ParsedSet[] {
  if (!score || !score.trim()) return [];
  // Разбиваем по пробелам, каждый токен — сет
  return score
    .trim()
    .split(/\s+/)
    .map((token) => {
      // матч с опциональным тай-брейком в скобках
      const m = token.match(/^(\d+)[\:\-](\d+)(?:\((\d+)\))?$/);
      if (!m) return null;
      const p1 = Number(m[1]);
      const p2 = Number(m[2]);
      const tb = m[3] ? Number(m[3]) : undefined;
      return {
        p1,
        p2,
        p1Won: p1 > p2,
        p2Won: p2 > p1,
        tb,
      } as ParsedSet;
    })
    .filter((x): x is ParsedSet => x !== null);
}

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
