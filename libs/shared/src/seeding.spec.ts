import {
  normalizeSeeds,
  nextSeedNumber,
  hasSeedConflict,
  seedsByRating,
  removeAndRenumber,
  swapSeeds,
  type SeedEntry,
} from './seeding';

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
  assert(JSON.stringify(a) === JSON.stringify(b), `${msg} | got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
}

function test_normalize_dedupesPlayer() {
  // Один игрок дважды → остаётся одна запись (первая)
  const r = normalizeSeeds([
    { playerId: 'a', seed: 1 },
    { playerId: 'a', seed: 2 },
  ]);
  eq(r, [{ playerId: 'a', seed: 1 }], 'dedupe by player keeps first');
}

function test_normalize_dedupesSeedNumber() {
  // Два игрока с одинаковым номером → остаётся первый, второй отбрасывается
  const r = normalizeSeeds([
    { playerId: 'a', seed: 1 },
    { playerId: 'b', seed: 1 },
  ]);
  eq(r, [{ playerId: 'a', seed: 1 }], 'dedupe by seed number');
}

function test_normalize_dropsInvalid() {
  const r = normalizeSeeds([
    { playerId: 'a', seed: 1 },
    { playerId: 'b', seed: 0 },   // некорректный
    { playerId: 'c', seed: -1 },  // некорректный
    { playerId: 'd', seed: NaN }, // некорректный
    { playerId: '', seed: 2 },    // нет id
  ]);
  eq(r, [{ playerId: 'a', seed: 1 }], 'drop invalid entries');
}

function test_normalize_sorts() {
  const r = normalizeSeeds([
    { playerId: 'c', seed: 3 },
    { playerId: 'a', seed: 1 },
    { playerId: 'b', seed: 2 },
  ]);
  eq(r.map((e) => e.playerId), ['a', 'b', 'c'], 'sorted by seed asc');
}

function test_nextSeedNumber() {
  eq(nextSeedNumber([]), 1, 'empty → 1');
  eq(nextSeedNumber([{ playerId: 'a', seed: 1 }]), 2, 'max 1 → 2');
  eq(
    nextSeedNumber([
      { playerId: 'a', seed: 1 },
      { playerId: 'b', seed: 5 },
    ]),
    6,
    'max 5 → 6',
  );
}

function test_hasSeedConflict() {
  assert(hasSeedConflict([{ playerId: 'a', seed: 1 }, { playerId: 'b', seed: 1 }]) === true, 'same seed → conflict');
  assert(hasSeedConflict([{ playerId: 'a', seed: 1 }, { playerId: 'b', seed: 2 }]) === false, 'distinct seeds → no conflict');
  assert(hasSeedConflict([{ playerId: 'a', seed: 1 }, { playerId: 'a', seed: 2 }]) === true, 'same player → conflict');
}

function test_seedsByRating() {
  const players = [
    { _id: 'low', rating: 100 },
    { _id: 'high', rating: 900 },
    { _id: 'mid', rating: 500 },
    { _id: 'norating' }, // без рейтинга — не участвует
  ];
  const r = seedsByRating(players);
  eq(
    r,
    [
      { playerId: 'high', seed: 1 },
      { playerId: 'mid', seed: 2 },
      { playerId: 'low', seed: 3 },
    ],
    'rating desc → seed 1,2,3',
  );
}

function test_seedsByRating_withCount() {
  const players = [
    { _id: 'a', rating: 900 },
    { _id: 'b', rating: 500 },
    { _id: 'c', rating: 100 },
  ];
  const r = seedsByRating(players, 2);
  eq(r.length, 2, 'count limit');
  eq(r[0].playerId, 'a', 'top rated first');
  eq(r[1].playerId, 'b', 'second rated');
}

function test_removeAndRenumber() {
  const entries: SeedEntry[] = [
    { playerId: 'a', seed: 1 },
    { playerId: 'b', seed: 2 },
    { playerId: 'c', seed: 3 },
  ];
  // Удаляем 'b' (seed 2) → 'a' остаётся 1, 'c' становится 2
  const r = removeAndRenumber(entries, 'b');
  eq(
    r,
    [
      { playerId: 'a', seed: 1 },
      { playerId: 'c', seed: 2 },
    ],
    'remove middle + renumber',
  );
}

function test_swapSeeds() {
  const entries: SeedEntry[] = [
    { playerId: 'a', seed: 1 },
    { playerId: 'b', seed: 2 },
    { playerId: 'c', seed: 3 },
  ];
  // Меняем seed 1 и 3 местами
  const r = swapSeeds(entries, 1, 3);
  eq(
    r,
    [
      { playerId: 'c', seed: 1 },
      { playerId: 'b', seed: 2 },
      { playerId: 'a', seed: 3 },
    ],
    'swap seed 1<->3 + renumber',
  );
}

function test_swapSeeds_invalidSeed() {
  const entries: SeedEntry[] = [{ playerId: 'a', seed: 1 }];
  // Несуществующий seed → без изменений
  const r = swapSeeds(entries, 1, 99);
  eq(r, [{ playerId: 'a', seed: 1 }], 'invalid seed → unchanged');
}

// --- Run ---
test_normalize_dedupesPlayer();
test_normalize_dedupesSeedNumber();
test_normalize_dropsInvalid();
test_normalize_sorts();
test_nextSeedNumber();
test_hasSeedConflict();
test_seedsByRating();
test_seedsByRating_withCount();
test_removeAndRenumber();
test_swapSeeds();
test_swapSeeds_invalidSeed();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  throw new Error(`${failed} seeding test(s) failed`);
}
