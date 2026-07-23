/**
 * Логика судейства теннисного матча.
 * Чистые функции — без побочных эффектов, легко тестируются.
 *
 * Поддерживается формата best-of-N сетов, гейм со стандартным счётом
 * (0/15/30/40), правилом "deuce/advantage" и тай-брейком до 7 (с разницей в 2).
 */

/** Какому игроку добавлено очко: 1 или 2 (внутренняя индексация с 1, как в UI). */
export type Side = 1 | 2;

/** Результат одного нажатия судьи. */
export interface ScoringResult {
  /** Состояние матчей (иммутабельно — новый объект). */
  state: MatchScoringState;
  /** Сетка завершена ли (определён победитель матча). */
  matchOver: boolean;
  /** Какой игрок выиграл матч (если matchOver). */
  winner?: Side;
}

/** Отображаемое очко в гейме (текст для табло). */
export type GamePoint = '0' | '15' | '30' | '40' | 'AD';

/** Текущее состояние судейства одного матча. */
export interface MatchScoringState {
  /** Кол-во выигранных сетов каждым игроком. */
  sets: [number, number];
  /** Текущий счёт геймов в каждом сете: [ [игрок1, игрок2], ... ]. */
  games: [number, number][];
  /** Очки в текущем гейме: ['0'|'15'|'30'|'40'|'AD', ...]. */
  points: [GamePoint, GamePoint];
  /** В тай-брейке очки считаются числами, а не 15/30/40. */
  isTiebreak: boolean;
  /** Очки тай-брейка, если isTiebreak. */
  tiebreakPoints: [number, number];
  /** Номер текущего сета (с 1). */
  currentSet: number;
  /** Всего сетов играется (best-of). */
  bestOf: number;
  /** Сколько геймов нужно для выигрыша сета (обычно 6). */
  gamesPerSet: number;
  /** Включён ли тай-брейк при 6:6. */
  tiebreakAtDeuce: boolean;
}

export const DEFAULT_SCORING_CONFIG = {
  bestOf: 3,
  gamesPerSet: 6,
  tiebreakAtDeuce: true,
} as const;

/**
 * Создаёт начальное состояние скоринга для матча best-of-N сетов.
 */
export function createInitialScoringState(
  bestOf: number = DEFAULT_SCORING_CONFIG.bestOf,
  gamesPerSet: number = DEFAULT_SCORING_CONFIG.gamesPerSet,
  tiebreakAtDeuce: boolean = DEFAULT_SCORING_CONFIG.tiebreakAtDeuce,
): MatchScoringState {
  const sets: [number, number] = [0, 0];
  const games: [number, number][] = [[0, 0]];
  return {
    sets,
    games,
    points: ['0', '0'],
    isTiebreak: false,
    tiebreakPoints: [0, 0],
    currentSet: 1,
    bestOf,
    gamesPerSet,
    tiebreakAtDeuce,
  };
}

/** Сколько сетов нужно выиграть, чтобы закончить матч. */
export function setsNeededToWin(state: MatchScoringState): number {
  return Math.ceil(state.bestOf / 2);
}

const POINT_SEQUENCE: GamePoint[] = ['0', '15', '30', '40'];

function nextPointIndex(current: GamePoint): number {
  const idx = POINT_SEQUENCE.indexOf(current);
  return idx === -1 ? 0 : idx + 1;
}

/**
 * Применяет очко к игроку `winner` (1 или 2). Возвращает новое состояние.
 * Обрабатывает: гейм, выигрыш гейма, тай-брейк, сет, конец матча.
 */
export function addPoint(prev: MatchScoringState, winner: Side): ScoringResult {
  const state: MatchScoringState = {
    ...prev,
    sets: [...prev.sets] as [number, number],
    games: prev.games.map(g => [...g] as [number, number]),
    points: [...prev.points] as [GamePoint, GamePoint],
    tiebreakPoints: [...prev.tiebreakPoints] as [number, number],
  };

  // --- Тай-брейк ---
  if (state.isTiebreak) {
    const w = winner - 1;
    state.tiebreakPoints[w] += 1;
    const other = 1 - w;
    const lead = state.tiebreakPoints[w] - state.tiebreakPoints[other];
    // Тай-брейк до 7 с разницей 2
    if (state.tiebreakPoints[w] >= 7 && lead >= 2) {
      return finishSet(state, winner);
    }
    return { state, matchOver: false };
  }

  // --- Обычный гейм ---
  const w = winner - 1;
  const other = 1 - w;
  const winnerPoint = state.points[w];
  const otherPoint = state.points[other];

  // Соперник на advantage — отбираем преимущество (возвращаем к 40:40)
  if (otherPoint === 'AD') {
    state.points[other] = '40';
    return { state, matchOver: false };
  }
  // Победитель на advantage — гейм выигран
  if (winnerPoint === 'AD') {
    return finishGame(state, winner);
  }
  // Победитель на 40: либо выигрыш гейма, либо выдача advantage при 40:40
  if (winnerPoint === '40') {
    if (otherPoint === '40') {
      state.points[w] = 'AD';
      return { state, matchOver: false };
    }
    return finishGame(state, winner);
  }

  // Обычное продвижение по последовательности 0→15→30→40
  const idx = nextPointIndex(winnerPoint);
  if (idx >= POINT_SEQUENCE.length) {
    return finishGame(state, winner);
  }
  state.points[w] = POINT_SEQUENCE[idx];
  return { state, matchOver: false };
}

/** Обрабатывает выигрыш гейма игроком winner: обнуляет очки, +1 гейм, проверяет сет. */
function finishGame(prev: MatchScoringState, winner: Side): ScoringResult {
  const w = winner - 1;
  const other = 1 - w;
  // Глубокая копия games: новый массив + новые пары [g1,g2], чтобы React видел изменения
  const games = prev.games.map(g => [...g] as [number, number]);
  const cur = games[prev.currentSet - 1] ?? [0, 0];
  cur[w] += 1;
  games[prev.currentSet - 1] = cur;
  const state: MatchScoringState = {
    ...prev,
    games,
    points: ['0', '0'] as [GamePoint, GamePoint],
  };

  // Переход в тай-брейк при gamesPerSet:gamesPerSet (напр. 6:6)
  if (
    state.tiebreakAtDeuce &&
    cur[w] === state.gamesPerSet &&
    cur[other] === state.gamesPerSet
  ) {
    state.isTiebreak = true;
    state.tiebreakPoints = [0, 0];
    return { state, matchOver: false };
  }

  // Выигрыш сета: ведущий достиг gamesPerSet и впереди на 2 гейма (или уже 7+ в advantage-сете)
  const lead = cur[w] - cur[other];
  const winsSet =
    (cur[w] >= state.gamesPerSet && lead >= 2) || cur[w] >= state.gamesPerSet + 1;
  if (winsSet) {
    return finishSet(state, winner);
  }
  return { state, matchOver: false };
}

/** Обрабатывает выигрыш сета: +1 в sets, проверяет конец матча. */
function finishSet(prev: MatchScoringState, winner: Side): ScoringResult {
  const state: MatchScoringState = {
    ...prev,
    isTiebreak: false,
    tiebreakPoints: [0, 0],
    points: ['0', '0'] as [GamePoint, GamePoint],
  };
  const w = winner - 1;
  state.sets[w] += 1;

  const needed = setsNeededToWin(state);
  if (state.sets[w] >= needed) {
    return { state, matchOver: true, winner };
  }

  // Переход к следующему сету
  state.currentSet += 1;
  // Гарантируем, что есть массив под следующий сет
  if (!state.games[state.currentSet - 1]) {
    state.games[state.currentSet - 1] = [0, 0];
  }
  return { state, matchOver: false };
}

/**
 * Отменяет последнее очко. Реализовано через переигрывание из истории очков,
 * которая хранится на стороне UI (здесь — только вспомогательная функция по
 * начальному состоянию и списку сторон-победителей).
 */
export function replayFromSides(
  start: MatchScoringState,
  sides: Side[],
): ScoringResult {
  let result: ScoringResult = { state: start, matchOver: false };
  for (const s of sides) {
    result = addPoint(result.state, s);
  }
  return result;
}

/**
 * Сериализует состояние в строку счёта для БД: "6-4 3-6 7-6(5)".
 * Завершённые и текущий сет отображаются через счёт геймов; для идущего
 * тай-брейка счёт тай-брейка проигравшего дописывается в скобках.
 */
export function formatScore(state: MatchScoringState): string {
  const parts: string[] = [];
  for (let i = 0; i < state.games.length; i++) {
    const g = state.games[i];
    // Не показываем текущий пустой сет (0:0) вне тай-брейка
    if (g[0] === 0 && g[1] === 0 && i === state.games.length - 1 && !state.isTiebreak) {
      continue;
    }
    let setStr = `${g[0]}-${g[1]}`;
    // Тай-брейк текущего сета: дописываем счёт проигравшего, напр. 7-6(5)
    if (
      state.isTiebreak &&
      i === state.currentSet - 1 &&
      (state.tiebreakPoints[0] > 0 || state.tiebreakPoints[1] > 0)
    ) {
      const tbLoser = state.tiebreakPoints[0] > state.tiebreakPoints[1] ? 1 : 0;
      setStr += `(${state.tiebreakPoints[tbLoser]})`;
    }
    parts.push(setStr);
  }
  return parts.join(' ');
}

/**
 * Возвращает сторону-победителя по winnerId игрока.
 * player1Id / player2Id — id игроков, winnerId — id победителя.
 */
export function sideByPlayerId(
  player1Id: string | undefined,
  player2Id: string | undefined,
  winnerId: string | null | undefined,
): Side | null {
  if (!winnerId) return null;
  if (player1Id && String(player1Id) === String(winnerId)) return 1;
  if (player2Id && String(player2Id) === String(winnerId)) return 2;
  return null;
}
