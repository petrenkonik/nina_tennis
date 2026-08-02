/**
 * Разбор строки счёта матча в наборы (сеты) — единый источник правды для
 * UI (ScorePill, статистика игрока) и подсчёта турнирной таблицы (standings).
 */

/** Один сет из строки счёта: "6-4" → { p1: 6, p2: 4, p1Won, p2Won } */
export interface ParsedSet {
  /** Геймы стороны 1 (player1/капитан стороны 1). */
  p1: number;
  /** Геймы стороны 2 (player2/капитан стороны 2). */
  p2: number;
  p1Won: boolean;
  p2Won: boolean;
  /** Счёт тай-брейка в скобках, если есть: "7-6(5)" → 5. */
  tb?: number;
}

/**
 * Разбирает строку счёта матча в массив сетов.
 * Принимает форматы: "6-4 3-6 7-5", "6-4 7-6(5)", "6:4 3:6".
 * Тай-брейк в скобках игнорируется при подсчёте геймов (он решает сет,
 * но не добавляет геймов в стандартном подсчёте турнирной таблицы).
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
