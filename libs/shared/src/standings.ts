/**
 * Подсчёт турнирной таблицы круговой системы на стороне клиента.
 * Зеркало SQL-функции get_group_standings: очки победа=2, поражение=1;
 * тай-брейк мест — по разнице сетов, затем геймов, затем выигранным геймам.
 */
import type { Match, Player, StandingsEntry } from './models/tennis';
import { parseScore } from './score';

/** Минимальный «вид» матча, нужный для подсчёта таблицы. */
export interface StandingsMatch {
  player1Id: string | null;
  player2Id: string | null;
  winnerId?: string | null;
  score?: string | null;
  status?: string;
}

/**
 * Считает турнирную таблицу по списку завершённых матчей.
 *
 * Единица турнира = капитан стороны (player1/player2). Завершёнными считаются
 * матчи со status='finished', известным победителем и непустым счётом.
 *
 * @param matches Матчи группы (любой объект с нужными полями, включая Match).
 * @param units   Единицы турнира с метаданными игрока/пары (для имён/фото).
 *                Ключ — id капитана; partner — необязательный партнёр (doubles).
 */
export function computeStandings(
  matches: StandingsMatch[] | Match[],
  units: Map<string, { player: Player; partner?: Player | null }>,
): StandingsEntry[] {
  type Acc = {
    player: Player;
    partner?: Player | null;
    matchesPlayed: number;
    wins: number;
    losses: number;
    setsWon: number;
    setsLost: number;
    gamesWon: number;
    gamesLost: number;
  };

  const acc = new Map<string, Acc>();
  const get = (id: string): Acc => {
    let e = acc.get(id);
    if (!e) {
      const meta = units.get(id);
      e = {
        player: meta?.player ?? { _id: id, fullName: '' },
        partner: meta?.partner,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
      };
      acc.set(id, e);
    }
    return e;
  };

  const applySide = (id: string, isSide1: boolean, won: boolean, sets: ReturnType<typeof parseScore>) => {
    const e = get(id);
    e.matchesPlayed += 1;
    if (won) e.wins += 1;
    else e.losses += 1;
    for (const s of sets) {
      const mine = isSide1 ? s.p1 : s.p2;
      const theirs = isSide1 ? s.p2 : s.p1;
      e.gamesWon += mine;
      e.gamesLost += theirs;
      if (mine > theirs) e.setsWon += 1;
      else if (theirs > mine) e.setsLost += 1;
    }
  };

  for (const m of matches) {
    const status = (m as any).status;
    const winnerId = (m as any).winnerId ?? null;
    const score: string | null | undefined = (m as any).score;
    const p1 = (m as any).player1Id ?? null;
    const p2 = (m as any).player2Id ?? null;
    if (status && status !== 'finished') continue;
    if (!winnerId || !score || !score.trim()) continue;
    if (!p1 || !p2) continue;

    const sets = parseScore(score);
    applySide(p1, true, winnerId === p1, sets);
    applySide(p2, false, winnerId === p2, sets);
  }

  const rows: StandingsEntry[] = [...acc.values()].map((e) => ({
    player: e.player,
    partner: e.partner,
    matchesPlayed: e.matchesPlayed,
    wins: e.wins,
    losses: e.losses,
    setsWon: e.setsWon,
    setsLost: e.setsLost,
    gamesWon: e.gamesWon,
    gamesLost: e.gamesLost,
    points: e.wins * 2 + e.losses * 1,
    position: 0,
  }));

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.setsWon - b.setsLost - (a.setsWon - a.setsLost) ||
      b.gamesWon - b.gamesLost - (a.gamesWon - a.gamesLost) ||
      b.gamesWon - a.gamesWon,
  );
  rows.forEach((r, i) => (r.position = i + 1));

  return rows;
}
