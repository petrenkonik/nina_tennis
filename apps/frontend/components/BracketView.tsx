"use client";

import React, { useState, useMemo } from 'react';
import { cx } from 'components/ui/cx';
import { Button } from 'components/ui';
import { FaSearchPlus, FaSearchMinus, FaUndo } from 'react-icons/fa';
import MatchCard, { type BracketMatch } from './MatchCard';

export interface BracketRound {
  title: string;
  seeds: BracketMatch[];
}

export interface BracketViewProps {
  rounds: BracketRound[];
  /** Построить ссылку для клика по матчу (matchId → href). */
  matchHref?: (matchId: string) => string;
  compact?: boolean;
  className?: string;
}

const MATCH_HEIGHT = 132; // высота карточки матча, px (реальная: шапка+2 игрока+футер)
const MATCH_GAP = 20; // базовый зазор между матчами в первом раунде, px

export default function BracketView({ rounds, matchHref, compact, className }: BracketViewProps) {
  const [zoom, setZoom] = useState(1);

  const resetZoom = () => setZoom(1);

  // Вычисляем общую высоту сетки для вертикального центрирования колонок
  const totalHeight = useMemo(() => {
    const firstRoundMatches = rounds[0]?.seeds.length ?? 0;
    const matchesNeeded = Math.max(firstRoundMatches, 1);
    return matchesNeeded * MATCH_HEIGHT + (matchesNeeded - 1) * MATCH_GAP;
  }, [rounds]);

  if (!rounds || rounds.length === 0) {
    return (
      <div className="text-center py-12 text-content-muted">
        <div className="text-4xl mb-3">🏆</div>
        <p>Сетка ещё не сформирована</p>
      </div>
    );
  }

  return (
    <div className={cx('relative', className)}>
      {/* Зум-контролы */}
      <div className="sticky top-2 z-20 flex justify-end gap-1 mb-2">
        <div className="inline-flex items-center gap-1 rounded-lg border border-surface-border bg-surface-card shadow-sm p-1">
          <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} aria-label="Уменьшить">
            <FaSearchMinus />
          </Button>
          <span className="text-xs text-content-muted tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))} aria-label="Увеличить">
            <FaSearchPlus />
          </Button>
          <Button variant="ghost" size="sm" onClick={resetZoom} aria-label="Сбросить масштаб">
            <FaUndo />
          </Button>
        </div>
      </div>

      {/* Горизонтальная прокрутка */}
      <div className="overflow-x-auto pb-4">
        <div
          className="flex items-stretch origin-top-left transition-transform duration-200"
          style={{ transform: `scale(${zoom})`, height: totalHeight * zoom }}
        >
          {rounds.map((round, rIdx) => {
            // На каждом следующем раунде вертикальный отступ удваивается, чтобы
            // матчи центрировались относительно пары из предыдущего раунда.
            const spacing = MATCH_HEIGHT + (2 ** rIdx) * (MATCH_HEIGHT + MATCH_GAP) - MATCH_HEIGHT;
            const isFirst = rIdx === 0;
            const isLast = rIdx === rounds.length - 1;

            return (
              <div key={rIdx} className="flex flex-col" style={{ minWidth: compact ? 210 : 260 }}>
                {/* Заголовок раунда */}
                <div className="sticky top-0 z-10 mb-2">
                  <div className="inline-block px-3 py-1 rounded-md bg-brand-600 text-white text-xs font-semibold shadow-sm">
                    {round.title}
                  </div>
                </div>

                {/* Контейнер раунда: вертикально распределённые матчи + соединители */}
                <div
                  className="relative flex flex-col flex-1"
                  style={{ justifyContent: isFirst ? 'flex-start' : 'space-around', gap: isFirst ? `${MATCH_GAP}px` : undefined }}
                >
                  {round.seeds.map((match, mIdx) => (
                    <div
                      key={match.id || mIdx}
                      className="relative flex items-center overflow-visible"
                      style={{ minHeight: MATCH_HEIGHT, flex: '0 0 auto' }}
                    >
                      <MatchCard
                        match={match}
                        roundIndex={rIdx}
                        href={matchHref ? matchHref(match.id) : undefined}
                        compact={compact}
                        connector={isLast ? 'none' : 'right'}
                      />

                      {/* Соединительные линии К ПРЕДЫДУЩЕМУ раунду (слева) */}
                      {!isFirst && <Connectors side="left" index={mIdx} spacing={spacing} />}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Рисует соединительные линии между матчем текущего раунда и парой матчей
 * предыдущего раунда. Т-образный соединитель: вертикаль + горизонталь.
 */
function Connectors({ side, index, spacing }: { side: 'left'; index: number; spacing: number }) {
  // Каждому матчу соответствуют 2 матча предыдущего раунда.
  // Рисуем горизонтальную линию от карточки + вертикальную, связывающую пару.
  const halfSpacing = spacing / 2;
  const isTop = index % 2 === 0;
  return (
    <div className={cx('absolute top-1/2 h-px pointer-events-none', side === 'left' && '-left-4 w-4')}>
      {/* горизонталь к колонке */}
      <span className="block w-full h-px bg-surface-border" />
      {/* вертикаль, соединяющая с парным матчем */}
      <span
        className="absolute left-0 w-px bg-surface-border"
        style={{
          height: isTop ? halfSpacing : halfSpacing,
          [isTop ? 'top' : 'bottom']: 0,
        } as React.CSSProperties}
      />
    </div>
  );
}
