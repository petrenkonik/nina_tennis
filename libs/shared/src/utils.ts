/**
 * Форматирует дату в формате дд.мм.гггг (ru-RU)
 * @param dateStr ISO-строка даты
 * @returns Строка в формате дд.мм.гггг
 */
export function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU');
}

/**
 * Преобразует дату к формату YYYY-MM-DD для input type="date"
 * @param dateStr ISO-строка даты
 * @returns Строка в формате YYYY-MM-DD
 */
export function toDateInputValue(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Возвращает статус турнира по датам
 * @param t Объект с startDate и endDate
 * @returns 'Ожидается' | 'Идёт' | 'Завершён'
 */
export function getTournamentStatus(t: { startDate: string; endDate: string }) {
  const now = new Date();
  const start = new Date(t.startDate);
  const end = new Date(t.endDate);
  if (now < start) return 'Ожидается';
  if (now > end) return 'Завершён';
  return 'Идёт';
}

/**
 * Считает количество уникальных участников турнира
 * @param t Турнир с groups или playersCount
 * @returns Количество участников
 */
export function getParticipantsCount(t: { groups?: any[]; playersCount?: number }) {
  if (typeof t.playersCount === 'number') return t.playersCount;
  if (!t.groups) return 0;
  const allPlayers = t.groups.flatMap(g => g.players || []);
  const uniqueIds = new Set(allPlayers.map((p: any) => p._id));
  return uniqueIds.size;
}

/**
 * Считает количество групп в турнире
 * @param t Турнир с groups или groupsCount
 * @returns Количество групп
 */
export function getGroupsCount(t: { groups?: any[]; groupsCount?: number }) {
  if (typeof t.groupsCount === 'number') return t.groupsCount;
  return t.groups ? t.groups.length : 0;
}

/**
 * Генерирует олимпийскую (playoff) сетку для заданного списка игроков с учётом посева
 * @param players Список игроков (Player[]), у которых seed — номер посева (1 — самый сильный)
 * @returns Массив раундов, каждый из которых — массив матчей
 */
export function generateKnockoutBracket(players: any[]): any[][] {
  if (!players || players.length === 0) return [];
  // Сортируем по посеву: seed=1,2,3... в начало, остальные в случайном порядке
  const seeded = players.filter(p => typeof p.seed === 'number').sort((a, b) => a.seed - b.seed);
  const unseeded = players.filter(p => typeof p.seed !== 'number');
  // Перемешиваем несеяных
  for (let i = unseeded.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unseeded[i], unseeded[j]] = [unseeded[j], unseeded[i]];
  }
  // Итоговый список: посеянные + несеяные
  const all = [...seeded, ...unseeded];
  // Следующее число степени двойки >= n
  function nextPow2(n: number) {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }
  const total = nextPow2(all.length);
  const byes = total - all.length;
  // Распределяем игроков по сетке (алгоритм "snake seeding")
  const slots = Array(total).fill(null);
  // snake seeding: 1 vs last, 2 vs last-1, 3 vs last-2 ...
  let left = 0, right = total - 1, idx = 0;
  while (left < right && idx < all.length) {
    slots[left++] = all[idx++];
    if (idx < all.length) slots[right--] = all[idx++];
  }
  if (left === right && idx < all.length) slots[left] = all[idx++];
  // Первый раунд
  const rounds: any[][] = [];
  let current = [];
  for (let i = 0; i < total; i += 2) {
    current.push({
      player1: slots[i],
      player2: slots[i + 1],
      round: 1,
      status: 'scheduled',
    });
  }
  rounds.push(current);
  // Генерируем следующие раунды (кол-во матчей делится на 2)
  let matches = current.length;
  let roundNum = 2;
  while (matches > 1) {
    const nextRound = [];
    for (let i = 0; i < matches / 2; i++) {
      nextRound.push({
        player1: null,
        player2: null,
        round: roundNum,
        status: 'scheduled',
      });
    }
    rounds.push(nextRound);
    matches = nextRound.length;
    roundNum++;
  }
  return rounds;
} 