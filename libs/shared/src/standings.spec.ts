import { computeStandings } from './standings';
import type { Player } from './models/tennis';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error('  ✗ FAIL:', msg);
  }
}

function unit(id: string, name: string): { player: Player } {
  return { player: { _id: id, fullName: name } };
}

/** Победа = 2 очка, поражение = 1 очко. */
function test_points_win_loss() {
  const units = new Map([
    ['A', unit('A', 'Алиса')],
    ['B', unit('B', 'Боб')],
  ]);
  const matches = [
    { player1Id: 'A', player2Id: 'B', winnerId: 'A', score: '6-4 6-3', status: 'finished' },
  ];
  const table = computeStandings(matches, units);
  const alice = table.find((r) => r.player._id === 'A')!;
  const bob = table.find((r) => r.player._id === 'B')!;
  assert(alice.points === 2, `победа = 2 очка (получено ${alice.points})`);
  assert(bob.points === 1, `поражение = 1 очко (получено ${bob.points})`);
  assert(alice.wins === 1 && bob.losses === 1, 'победы/поражения');
}

/** Сеты и геймы считаются по всем сетам строки счёта. */
function test_sets_and_games() {
  const units = new Map([
    ['A', unit('A', 'Алиса')],
    ['B', unit('B', 'Боб')],
  ]);
  const matches = [
    { player1Id: 'A', player2Id: 'B', winnerId: 'A', score: '6-4 3-6 7-5', status: 'finished' },
  ];
  const table = computeStandings(matches, units);
  const alice = table.find((r) => r.player._id === 'A')!;
  const bob = table.find((r) => r.player._id === 'B')!;
  // Алиса выиграла сеты 1 и 3 (6-4, 7-5), проиграла 2-й (3-6)
  assert(alice.setsWon === 2 && alice.setsLost === 1, `сеты Алисы 2/1 (получено ${alice.setsWon}/${alice.setsLost})`);
  // Геймы Алисы: 6+3+7 = 16
  assert(alice.gamesWon === 16, `геймы Алисы = 16 (получено ${alice.gamesWon})`);
  // Геймы Боба: 4+6+5 = 15
  assert(bob.gamesWon === 15, `геймы Боба = 15 (получено ${bob.gamesWon})`);
}

/** Позиции: выше по очкам, затем по разнице сетов. */
function test_positions() {
  const units = new Map([
    ['A', unit('A', 'Алиса')],
    ['B', unit('B', 'Боб')],
    ['C', unit('C', 'Сид')],
  ]);
  const matches = [
    // A обыгрывает B и C → 4 очка, 1-е место
    { player1Id: 'A', player2Id: 'B', winnerId: 'A', score: '6-1 6-1', status: 'finished' },
    { player1Id: 'A', player2Id: 'C', winnerId: 'A', score: '6-1 6-1', status: 'finished' },
    // B обыгрывает C → у B 1W1L (3 очка), у C 0W2L (2 очка)
    { player1Id: 'B', player2Id: 'C', winnerId: 'B', score: '6-3 6-2', status: 'finished' },
  ];
  const table = computeStandings(matches, units);
  assert(table[0].player._id === 'A', '1-е место — A');
  assert(table[1].player._id === 'B', '2-е место — B');
  assert(table[2].player._id === 'C', '3-е место — C');
  assert(table[0].position === 1 && table[2].position === 3, 'позиции пронумерованы');
}

/** Тай-брейк мест при равенстве очков — по разнице сетов. */
function test_tiebreak_sets() {
  const units = new Map([
    ['A', unit('A', 'Алиса')],
    ['B', unit('B', 'Боб')],
  ]);
  // У обеих по 1 победе (по 3 очка). У A разница сетов +1, у B −1.
  const matches = [
    { player1Id: 'A', player2Id: 'B', winnerId: 'A', score: '6-0 6-0', status: 'finished' },
    { player1Id: 'A', player2Id: 'B', winnerId: 'B', score: '0-6 0-6 0-1', status: 'finished' },
  ];
  const table = computeStandings(matches, units);
  // A: 2 сета выиграно, 3 проиграно → разница -1. Пересчитаем вручную:
  //   матч 1: A 6-0 6-0 → sets +2, games +12
  //   матч 2: A 0-6 0-6 0-1 → sets -3, games -13  (B winner)
  // B симметрично. По очкам равны (по 3). A: setsWon-Lost = 2-3 = -1.
  assert(table[0].points === table[1].points, 'очки равны');
  assert(table[0].setsWon - table[0].setsLost > table[1].setsWon - table[1].setsLost, 'выше по разнице сетов');
}

/** Незавершённые / без счёта матчи игнорируются. */
function test_unfinished_ignored() {
  const units = new Map([
    ['A', unit('A', 'Алиса')],
    ['B', unit('B', 'Боб')],
  ]);
  const matches = [
    { player1Id: 'A', player2Id: 'B', winnerId: null, score: null, status: 'scheduled' },
    { player1Id: 'A', player2Id: 'B', winnerId: 'A', score: '', status: 'finished' },
    { player1Id: 'A', player2Id: 'B', winnerId: 'A', score: '6-4', status: 'finished' },
  ];
  const table = computeStandings(matches, units);
  // учитывается только последний матч
  const alice = table.find((r) => r.player._id === 'A')!;
  assert(alice.matchesPlayed === 1, `учитывается 1 матч (получено ${alice.matchesPlayed})`);
}

test_points_win_loss();
test_sets_and_games();
test_positions();
test_tiebreak_sets();
test_unfinished_ignored();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  throw new Error(`${failed} standings test(s) failed`);
}
