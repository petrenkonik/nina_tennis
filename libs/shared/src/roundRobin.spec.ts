import { generateRoundRobinPairings } from './roundRobin';

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

function eq(a: any, b: any, msg: string) {
  assert(JSON.stringify(a) === JSON.stringify(b), `${msg} (ожидалось ${JSON.stringify(b)}, получено ${JSON.stringify(a)})`);
}

/** Каждая пара единиц встречается ровно один раз. */
function test_each_pair_once() {
  const n = 6;
  const units = Array.from({ length: n }, (_, i) => i + 1);
  const matches = generateRoundRobinPairings(units);
  // ожидаемое число матчей: n*(n-1)/2
  assert(matches.length === (n * (n - 1)) / 2, `6 игроков → ${n * (n - 1) / 2} матчей (получено ${matches.length})`);

  const seen = new Set<string>();
  for (const m of matches) {
    const key = [m.a, m.b].sort().join('-');
    assert(!seen.has(key), `пара ${key} встречается дважды`);
    seen.add(key);
  }
  assert(seen.size === (n * (n - 1)) / 2, `уникальных пар: ${seen.size}`);
}

/** Круговая нечётного числа участников → число матчей как для (n+1) без bye-матчей. */
function test_odd_count() {
  const n = 5;
  const units = Array.from({ length: n }, (_, i) => i + 1);
  const matches = generateRoundRobinPairings(units);
  // 5 игроков → 10 матчей (как 6 слотов, но 1 bye-матч на раунд выпадает)
  assert(matches.length === (n * (n - 1)) / 2, `5 игроков → 10 матчей (получено ${matches.length})`);
  // 5 раундов (bye добавляет один раунд)
  const maxRound = Math.max(...matches.map((m) => m.round));
  assert(maxRound === 5, `5 игроков → 5 раундов (получено ${maxRound})`);
}

/** Каждый участник играет по одному матчу за раунд (кроме раунда со своим bye). */
function test_one_match_per_round() {
  const units = [1, 2, 3, 4];
  const matches = generateRoundRobinPairings(units);
  const perRound = new Map<number, number[]>();
  for (const m of matches) {
    const arr = perRound.get(m.round) ?? [];
    arr.push(m.a as number, m.b as number);
    perRound.set(m.round, arr);
  }
  for (const [round, players] of perRound) {
    const uniq = new Set(players);
    assert(uniq.size === players.length, `раунд ${round}: каждый играет один раз`);
  }
}

/** 4 игрока → 3 раунда, 6 матчей; известная раскладка. */
function test_four_players() {
  const matches = generateRoundRobinPairings([1, 2, 3, 4]);
  assert(matches.length === 6, '4 игрока → 6 матчей');
  const rounds = new Set(matches.map((m) => m.round));
  eq(rounds.size, 3, '4 игрока → 3 раунда');
}

/** Пустой / один участник → нет матчей. */
function test_empty_and_single() {
  assert(generateRoundRobinPairings([]).length === 0, 'пустой список → 0 матчей');
  assert(generateRoundRobinPairings([1]).length === 0, 'один участник → 0 матчей');
}

test_each_pair_once();
test_odd_count();
test_one_match_per_round();
test_four_players();
test_empty_and_single();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  throw new Error(`${failed} roundRobin test(s) failed`);
}
