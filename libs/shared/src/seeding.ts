/**
 * Логика посева (seeding) игроков в группе.
 * Чистые функции — без побочных эффектов, тестируются отдельно.
 */

/** Одна запись посева: id игрока + номер. */
export interface SeedEntry {
  playerId: string;
  seed: number;
}

/** Игрок с полями, нужными для посева. */
export interface SeedablePlayer {
  _id?: string;
  id?: string;
  rating?: number;
}

function pid(p: { _id?: string; id?: string }): string {
  return String(p._id ?? p.id ?? '');
}

/**
 * Нормализует список посева:
 *  - убирает дубли по playerId (оставляет первый),
 *  - отбрасывает некорректные seed (<= 0, NaN),
 *  - убирает дубли номеров (при конфликте игрок становится непосеянным),
 *  - сортирует по возрастанию seed.
 *
 * @returns массив валидных записей посева, отсортированных по seed.
 */
export function normalizeSeeds(entries: SeedEntry[]): SeedEntry[] {
  const seenPlayers = new Set<string>();
  const seenSeeds = new Set<number>();
  const result: SeedEntry[] = [];

  for (const entry of entries) {
    const id = String(entry.playerId);
    const seed = Number(entry.seed);
    if (!id || !Number.isFinite(seed) || seed <= 0) continue;
    if (seenPlayers.has(id)) continue;
    if (seenSeeds.has(seed)) continue; // дубль номера → пропускаем
    seenPlayers.add(id);
    seenSeeds.add(seed);
    result.push({ playerId: id, seed });
  }

  return result.sort((a, b) => a.seed - b.seed);
}

/**
 * Следующий свободный номер посева = max(текущие) + 1, минимум 1.
 */
export function nextSeedNumber(entries: SeedEntry[]): number {
  if (entries.length === 0) return 1;
  const max = Math.max(...entries.map((e) => e.seed));
  return max + 1;
}

/**
 * Проверяет, что у двух записей нет конфликта (одинаковый номер или игрок).
 */
export function hasSeedConflict(entries: SeedEntry[]): boolean {
  const seeds = new Set<number>();
  const players = new Set<string>();
  for (const e of entries) {
    if (seeds.has(e.seed) || players.has(e.playerId)) return true;
    seeds.add(e.seed);
    players.add(e.playerId);
  }
  return false;
}

/**
 * Автоматически распределяет посев по рейтингу: игроки сортируются по убыванию
 * rating, первые `count` получают seed 1, 2, 3...
 *
 * @param players список игроков группы
 * @param count сколько первых по рейтингу сделать посеянными (по умолчанию все)
 * @returns массив записей посева
 */
export function seedsByRating(players: SeedablePlayer[], count?: number): SeedEntry[] {
  const withRating = players
    .filter((p) => typeof p.rating === 'number' && Number.isFinite(p.rating))
    .map((p) => ({ id: pid(p), rating: p.rating as number }))
    .sort((a, b) => b.rating - a.rating);

  const limit = typeof count === 'number' && count > 0 ? count : withRating.length;
  return withRating.slice(0, limit).map((p, idx) => ({
    playerId: p.id,
    seed: idx + 1,
  }));
}

/**
 * Удаляет игрока из посева и перенумеровывает оставшихся, чтобы номера шли подряд (1..n).
 * Полезно после удаления игрока из середины списка.
 */
export function removeAndRenumber(entries: SeedEntry[], playerId: string): SeedEntry[] {
  const filtered = entries
    .filter((e) => e.playerId !== playerId)
    .sort((a, b) => a.seed - b.seed);
  return filtered.map((e, idx) => ({ playerId: e.playerId, seed: idx + 1 }));
}

/**
 * Меняет местами двух игроков по их seed-номерам и перенумеровывает подряд.
 * @param entries текущий посев
 * @param seedA номер первого игрока
 * @param seedB номер второго игрока
 */
export function swapSeeds(entries: SeedEntry[], seedA: number, seedB: number): SeedEntry[] {
  const sorted = [...entries].sort((a, b) => a.seed - b.seed);
  const idxA = sorted.findIndex((e) => e.seed === seedA);
  const idxB = sorted.findIndex((e) => e.seed === seedB);
  if (idxA === -1 || idxB === -1) return sorted;
  [sorted[idxA], sorted[idxB]] = [sorted[idxB], sorted[idxA]];
  return sorted.map((e, idx) => ({ playerId: e.playerId, seed: idx + 1 }));
}
