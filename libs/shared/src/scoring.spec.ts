import {
  createInitialScoringState,
  addPoint,
  formatScore,
  replayFromSides,
  setsNeededToWin,
  Side,
} from './scoring';

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

/** Накручивает серию очков и возвращает финальное состояние. */
function play(sides: Side[], bestOf = 3) {
  const start = createInitialScoringState(bestOf);
  return replayFromSides(start, sides);
}

function test_setAt30() {
  // 4 очка одному игроку = гейм (15,30,40,гейм)
  const s = createInitialScoringState(3);
  let r = { state: s, matchOver: false };
  r = addPoint(r.state, 1); // 15
  assert(r.state.points[0] === '15', 'point1=15');
  r = addPoint(r.state, 1); // 30
  assert(r.state.points[0] === '30', 'point1=30');
  r = addPoint(r.state, 1); // 40
  assert(r.state.points[0] === '40', 'point1=40');
  r = addPoint(r.state, 1); // гейм
  assert(r.state.points[0] === '0', 'после гейма очки сброшены');
  assert(r.state.games[0][0] === 1, 'games[0][0]=1');
}

function test_deuceAdvantage() {
  // 40:40 → AD → отбор → AD → гейм
  let r = play([1, 1, 1, 2, 2, 2]); // 40:40
  assert(r.state.points[0] === '40' && r.state.points[1] === '40', '40:40 deuce');
  r = addPoint(r.state, 1); // AD игроку1
  assert(r.state.points[0] === 'AD', 'player1 advantage');
  r = addPoint(r.state, 2); // обратно 40:40
  assert(r.state.points[0] === '40' && r.state.points[1] === '40', 'back to deuce');
  r = addPoint(r.state, 2); // AD игроку2
  assert(r.state.points[1] === 'AD', 'player2 advantage');
  r = addPoint(r.state, 2); // гейм игроку2
  assert(r.state.games[0][1] === 1, 'player2 won game');
}

function test_winSet6straight() {
  // Игрок1 выигрывает 6 геймов подряд (24 очка), сет 6-0
  const sides: Side[] = [];
  for (let g = 0; g < 6; g++) for (let i = 0; i < 4; i++) sides.push(1);
  const r = play(sides);
  assert(r.state.sets[0] === 1 && r.state.sets[1] === 0, 'set1 won 6-0');
  assert(formatScore(r.state) === '6-0', 'score 6-0, got: ' + formatScore(r.state));
}

function test_tiebreak() {
  // Доводим до 6:6, затем тай-брейк: игрок1 выигрывает 7-2
  const sides: Side[] = [];
  // 5 геймов игроку1 (6-0 было бы, делаем 5-0)
  for (let g = 0; g < 5; g++) for (let i = 0; i < 4; i++) sides.push(1);
  // 5 геймов игроку2 → 5:5
  for (let g = 0; g < 5; g++) for (let i = 0; i < 4; i++) sides.push(2);
  // 6:5 игрок1
  for (let i = 0; i < 4; i++) sides.push(1);
  // 6:6 игрок2
  for (let i = 0; i < 4; i++) sides.push(2);

  let r = play(sides);
  assert(r.state.isTiebreak === true, 'вошли в тай-брейк при 6:6');
  assert(r.state.games[0][0] === 6 && r.state.games[0][1] === 6, '6:6 в геймах');

  // Игрок1 выигрывает тай-брейк 7:2
  for (let i = 0; i < 7; i++) r = addPoint(r.state, 1);
  for (let i = 0; i < 2; i++) r = addPoint(r.state, 2);
  // Последние очки могли завершить сет досрочно — проверяем финал
  assert(r.state.sets[0] === 1, 'set1 won via tiebreak');
  assert(r.matchOver === false, 'best-of-3 → матч ещё не окончен после 1 сета');
}

function test_matchWin2sets() {
  // best-of-3: игрок1 выигрывает 2 сета по 6-0 → матч окончен
  const sides: Side[] = [];
  for (let set = 0; set < 2; set++) {
    for (let g = 0; g < 6; g++) for (let i = 0; i < 4; i++) sides.push(1);
  }
  const r = play(sides);
  assert(r.matchOver === true, 'match over after 2 sets');
  assert(r.winner === 1, 'winner is player 1');
  assert(r.state.sets[0] === 2, 'sets 2-0');
}

function test_formatScore() {
  // Реалистичное чередование: 1й сет 6-4 (игрок1), 2й сет 2-1 (текущий)
  const sides: Side[] = [];
  // 10 геймов с итогом 6-4: P1 доводит до 5, P2 набирает 4, затем P1 берёт сет
  const set1Games: Side[] = [1, 2, 1, 2, 1, 2, 1, 2, 1, 1];
  for (const winner of set1Games) for (let i = 0; i < 4; i++) sides.push(winner);
  // 2й сет: 2-1 игроку1
  for (const winner of [1, 2, 1] as Side[]) for (let i = 0; i < 4; i++) sides.push(winner);
  const r = play(sides);
  const score = formatScore(r.state);
  assert(score === '6-4 2-1', 'score 6-4 2-1, got: ' + score);
  assert(r.state.sets[0] === 1 && r.state.sets[1] === 0, 'set won 1-0');
}

function test_setsNeeded() {
  assert(setsNeededToWin(createInitialScoringState(3)) === 2, 'best of 3 → need 2');
  assert(setsNeededToWin(createInitialScoringState(5)) === 3, 'best of 5 → need 3');
}

// --- Run ---
test_setAt30();
test_deuceAdvantage();
test_winSet6straight();
test_tiebreak();
test_matchWin2sets();
test_formatScore();
test_setsNeeded();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  // Бросаем ошибку, чтобы любой раннер (jest/ts-node/node) сигнализировал провал.
  throw new Error(`${failed} scoring test(s) failed`);
}
