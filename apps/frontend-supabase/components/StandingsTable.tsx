"use client";

import React from 'react';
import { cx } from 'components/ui/cx';
import type { StandingsEntry } from '@shared/models/tennis';

export interface StandingsTableProps {
  entries: StandingsEntry[];
  className?: string;
  /** Показать колонку с партнёром (парные турниры). */
  doubles?: boolean;
  /** Заголовок блока. */
  title?: string;
}

/**
 * Турнирная таблица круговой системы: места, матчи (И/В/П), сеты и геймы (+/−),
 * очки. Подсветка призовой тройки (золото/серебро/бронза).
 */
export default function StandingsTable({
  entries,
  className,
  doubles = false,
  title = 'Турнирная таблица',
}: StandingsTableProps) {
  if (!entries.length) {
    return (
      <div className="text-center py-12 text-content-muted">
        <div className="text-4xl mb-3">📊</div>
        <p>Нет сыгранных матчей</p>
      </div>
    );
  }

  return (
    <div className={cx('rounded-xl border border-surface-border bg-surface-card shadow-sm overflow-hidden', className)}>
      <div className="px-4 py-3 border-b border-surface-border bg-surface-muted/50">
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-content-muted border-b border-surface-border">
              <th className="py-2 px-2 text-left font-medium w-8">#</th>
              <th className="py-2 px-2 text-left font-medium">{doubles ? 'Пара' : 'Игрок'}</th>
              <th className="py-2 px-2 text-center font-medium" title="Игры сыграны">И</th>
              <th className="py-2 px-2 text-center font-medium" title="Победы">В</th>
              <th className="py-2 px-2 text-center font-medium" title="Поражения">П</th>
              <th className="py-2 px-2 text-center font-medium" title="Выиграно-проиграно сетов">Сеты</th>
              <th className="py-2 px-2 text-center font-medium" title="Выиграно-проиграно геймов">Геймы</th>
              <th className="py-2 px-2 text-center font-semibold">Очки</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.player._id} className="border-b border-surface-border last:border-0 hover:bg-surface-muted/30">
                <td className="py-2 px-2">
                  <PositionBadge position={e.position} />
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2">
                    {e.player.photoUrl && (
                      <img
                        src={e.player.photoUrl}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover"
                      />
                    )}
                    <span className="font-medium">{e.player.fullName}</span>
                    {doubles && e.partner && (
                      <span className="text-content-muted">/ {e.partner.fullName}</span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-2 text-center tabular-nums">{e.matchesPlayed}</td>
                <td className="py-2 px-2 text-center tabular-nums text-emerald-600 font-medium">{e.wins}</td>
                <td className="py-2 px-2 text-center tabular-nums text-content-muted">{e.losses}</td>
                <td className="py-2 px-2 text-center tabular-nums">
                  <SetsDiff won={e.setsWon} lost={e.setsLost} />
                </td>
                <td className="py-2 px-2 text-center tabular-nums text-content-muted">
                  <span title={`${e.gamesWon}-${e.gamesLost}`}>{e.gamesWon}:{e.gamesLost}</span>
                </td>
                <td className="py-2 px-2 text-center tabular-nums font-bold">{e.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Жетон места: призовая тройка — золото/серебро/бронза. */
function PositionBadge({ position }: { position: number }) {
  const medal =
    position === 1 ? 'bg-amber-100 text-amber-700'
    : position === 2 ? 'bg-slate-200 text-slate-600'
    : position === 3 ? 'bg-orange-100 text-orange-700'
    : 'bg-surface-muted text-content-muted';
  return (
    <span className={cx('inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold', medal)}>
      {position}
    </span>
  );
}

/** Сеты с разницей и знаком (+/−) для тай-брейка мест. */
function SetsDiff({ won, lost }: { won: number; lost: number }) {
  const diff = won - lost;
  const sign = diff > 0 ? '+' : '';
  return (
    <span title={`${won}-${lost}`}>
      <span className="font-medium">{won}</span>
      <span className="text-content-muted">:{lost}</span>
      <span className={cx('ml-1 text-xs', diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-400' : 'text-content-muted')}>
        {sign}{diff}
      </span>
    </span>
  );
}
