"use client";

import React, { useState, useMemo } from 'react';
import { cx } from 'components/ui/cx';
import { Button } from 'components/ui';
import { FaSearchPlus, FaSearchMinus, FaUndo } from 'react-icons/fa';
import MatchCard, { type BracketMatch, type MatchType } from './MatchCard';

export interface BracketRound {
  title: string;
  seeds: BracketMatch[];
}

export interface BracketViewProps {
  rounds: BracketRound[];
  /** Построить ссылку для клика по матчу (matchId → href). */
  matchHref?: (matchId: string) => string;
  compact?: boolean;
  /** Парный режим: карточки выше (партнёр под каждым игроком стороны). */
  doubles?: boolean;
  /** Матч за 3-е место (если есть) — рисуется отдельной карточкой вне дерева. */
  thirdPlace?: BracketMatch | null;
  className?: string;
}

const MATCH_HEIGHT_SINGLES = 132; // высота карточки матча, px (шапка+2 игрока+футер)
const MATCH_HEIGHT_DOUBLES = 188; // парный матч: доп. строки партнёров (+~56px)
const MATCH_GAP = 20; // базовый зазор между матчами в первом раунде, px

export default function BracketView({ rounds, matchHref, compact, doubles, thirdPlace, className }: BracketViewProps) {
  const [zoom, setZoom] = useState(1);
  const MATCH_HEIGHT = doubles ? MATCH_HEIGHT_DOUBLES : MATCH_HEIGHT_SINGLES;

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
      <div className="sticky top-2 z-20 flex items-start justify-between gap-2 mb-2 flex-wrap">
        {/* Зум-контролы */}
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
        {/* Легенда типов матчей */}
        <Legend />
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
            const prevRound = !isFirst ? rounds[rIdx - 1] : null;

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
                  {round.seeds.map((match, mIdx) => {
                    // Два матча предыдущего раунда, питающие этот (для пути победителя).
                    const topSource = prevRound?.seeds[mIdx * 2];
                    const bottomSource = prevRound?.seeds[mIdx * 2 + 1];

                    return (
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
                        {!isFirst && (
                          <Connectors
                            side="left"
                            index={mIdx}
                            spacing={spacing}
                            topResolved={hasMatchWinner(topSource)}
                            bottomResolved={hasMatchWinner(bottomSource)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Матч за 3-е место — отдельной колонкой вне бинарного дерева. */}
          {thirdPlace && (
            <div className="flex flex-col" style={{ minWidth: compact ? 210 : 260 }}>
              <div className="sticky top-0 z-10 mb-2">
                <div className="inline-block px-3 py-1 rounded-md bg-orange-500 text-white text-xs font-semibold shadow-sm">
                  За 3-е место
                </div>
              </div>
              <div className="relative flex flex-col flex-1" style={{ justifyContent: 'center' }}>
                <div
                  className="relative flex items-center overflow-visible"
                  style={{ minHeight: MATCH_HEIGHT, flex: '0 0 auto' }}
                >
                  <MatchCard
                    match={thirdPlace}
                    roundIndex={rounds.length}
                    href={matchHref ? matchHref(thirdPlace.id) : undefined}
                    compact={compact}
                    connector="none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Победитель матча определён → линия от него к следующему раунду «активна». */
function hasMatchWinner(m?: BracketMatch): boolean {
  return Boolean(m?.winner);
}

/**
 * Рисует соединительные линии между матчем текущего раунда и парой матчей
 * предыдущего раунда. Т-образный соединитель: вертикаль + горизонталь.
 * Сегменты, ведущие от матча с определённым победителем, подсвечиваются зелёным.
 */
function Connectors({
  side,
  index,
  spacing,
  topResolved = false,
  bottomResolved = false,
}: {
  side: 'left';
  index: number;
  spacing: number;
  topResolved?: boolean;
  bottomResolved?: boolean;
}) {
  // Каждому матчу соответствуют 2 матча предыдущего раунда.
  // Рисуем горизонтальную линию от карточки + вертикальную, связывающую пару.
  const halfSpacing = spacing / 2;
  const isTop = index % 2 === 0;
  // Этот соединитель «висит» на верхнем источнике (isTop) — значит его winner
  // определяет цвет выходящей из него линии (горизонталь + половина вертикали).
  const resolved = isTop ? topResolved : bottomResolved;
  const lineBase = 'bg-content-muted/40 dark:bg-content-muted/30';
  const lineWin = 'bg-emerald-500';
  return (
    <div className={cx('absolute top-1/2 pointer-events-none', side === 'left' && '-left-4 w-4 h-0.5 -translate-y-1/2')}>
      {/* горизонталь к колонке */}
      <span className={cx('block w-full h-0.5', resolved ? lineWin : lineBase)} />
      {/* вертикаль, соединяющая с парным матчем */}
      <span
        className={cx('absolute left-0 w-0.5', topResolved || bottomResolved ? lineWin : lineBase)}
        style={{
          height: halfSpacing,
          [isTop ? 'top' : 'bottom']: 0,
        } as React.CSSProperties}
      />
    </div>
  );
}

/** Компактная расшифровка цветов карточек сетки. */
const LEGEND: { type: MatchType; label: string; dot: string }[] = [
  { type: 'finished', label: 'Завершён', dot: 'bg-emerald-500' },
  { type: 'in_progress', label: 'В игре', dot: 'bg-live' },
  { type: 'scheduled', label: 'Запланирован', dot: 'bg-blue-400' },
  { type: 'tbd', label: 'Соперник TBD', dot: 'bg-content-muted/50' },
];

function Legend() {
  return (
    <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-surface-border bg-surface-card shadow-sm px-2.5 py-1.5">
      {LEGEND.map((item) => (
        <span key={item.type} className="inline-flex items-center gap-1.5 text-xs text-content-muted">
          <span className={cx('inline-block w-2.5 h-2.5 rounded-full', item.dot)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
