/**
 * Круговая система (round-robin): каждый играет с каждым.
 * Алгоритм «circle method» — тот же, что в SQL-функции generate_group_matches
 * (ветка round_robin), вынесен в чистый TS для тестов и возможного клиентского
 * пересчёта. null-элемент входного массива трактуется как bye (противник
 * с bye не играет — такой матч не возвращается).
 */

/** Один сгенерированный матч круговой: раунд и две единицы (или null = bye). */
export interface RoundRobinMatch<T> {
  round: number;
  a: T | null;
  b: T | null;
}

/**
 * Строит пары матчей круговой системы.
 *
 * @param units Массив единиц турнира (игроки или капитаны пар). null = bye.
 *   При нечётной длине фиктивный bye добавляется автоматически.
 * @returns Массив матчей { round, a, b }; матчи с bye (одна сторона null) исключаются.
 */
export function generateRoundRobinPairings<T>(units: (T | null)[]): RoundRobinMatch<T>[] {
  const arr: (T | null)[] = [...units];
  let n = arr.length;
  if (n < 2) return [];

  // Нечётное число единиц → добавляем bye (null), чтобы число стало чётным.
  if (n % 2 === 1) {
    arr.push(null);
    n += 1;
  }

  const rounds = n - 1;
  const matches: RoundRobinMatch<T>[] = [];

  // Позиция 1 зафиксирована; на каждом шаге вращаем позиции 2..n вправо на 1.
  for (let round = 1; round <= rounds; round++) {
    for (let k = 1; k <= n / 2; k++) {
      const a = arr[k - 1];
      const b = arr[n - k]; // 0-индексация: позиция n-k+1 в 1-индексации
      // bye → матч не играется
      if (a == null || b == null) continue;
      matches.push({ round, a, b });
    }
    // поворот: последний элемент хвоста (позиции 2..n) → на позицию 2
    const last = arr[n - 1];
    for (let i = n - 1; i > 1; i--) {
      arr[i] = arr[i - 1];
    }
    arr[1] = last;
  }

  return matches;
}
