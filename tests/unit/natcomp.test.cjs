'use strict';
// SAT-ONLINE-064 (Claude-B #13 item 25): the National Competition's schedule, scoring and rewards.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModules } = require('../harness/load-module.cjs');

const N = loadModules('src/net/natcomp.js').natcomp, C = N.C;
const T0 = Date.UTC(2026, 9, 20, 6, 0, 0); // 06:00 UTC, a start

test('every six hours, three ten-minute stages: hunting, production, arena; then the wait for the next', () => {
  const at = (ms) => N.now(T0 + ms);
  assert.deepEqual([at(0).running, at(0).stage, at(0).kind], [true, 0, 'hunt']);
  assert.equal(at(0).id, 'n' + Math.floor(T0 / C.PERIOD));
  assert.deepEqual([at(C.STAGE).kind, at(2 * C.STAGE + 1).kind], ['craft', 'duel']);
  assert.equal(at(C.STAGE - 1).stageEnd, T0 + C.STAGE);
  const after = at(3 * C.STAGE);
  assert.equal(after.running, false);
  assert.equal(after.stage, -1);
  assert.equal(after.id, at(0).id, 'the same competition until the next starts');
  assert.equal(after.next, T0 + C.PERIOD);
  assert.equal(N.now(T0 + C.PERIOD).id, 'n' + (Math.floor(T0 / C.PERIOD) + 1));
  assert.equal(N.now(T0 - 1).running, false, 'the minute before is the last one\'s wait');
  // a forced start (tests)
  const f = N.now(T0 + 5000, T0 + 4000);
  assert.deepEqual([f.running, f.stage, f.start], [true, 0, T0 + 4000]);
  // never at the castle siege's hours (odd hours, SIEGO 1 h)
  for (let h = 0; h < 24; h++) { const o = N.now(Date.UTC(2026, 9, 20, h, 5)); if (o.running) assert.equal(h % 2, 0, 'hour ' + h); }
});

test('scoring: a kill by level (a boss x10), an item by rating, a duel (three a foe)', () => {
  assert.equal(N.huntPts(1), 1);
  assert.equal(N.huntPts(100), 20);
  assert.equal(N.huntPts(16, true), 30);
  assert.deepEqual([0, 1, 2, 3, 4].map(N.craftPts), [5, 10, 20, 40, 80]);
  assert.deepEqual([N.duelPts(true, 0), N.duelPts(false, 2), N.duelPts(true, 3)], [C.WIN, C.LOSS, 0]);
});

test('rewards: the top three, the top ten, and something for everyone who scored', () => {
  assert.equal(N.reward(1, 500), C.BASE + 500 + C.PRIZE[0]);
  assert.equal(N.reward(3, 10), C.BASE + 10 + C.PRIZE[2]);
  assert.equal(N.reward(7, 10), C.BASE + 10 + C.TOP_GOLD);
  assert.equal(N.reward(0, 1e6), C.BASE + C.PER_MAX, 'a point a gold, capped');
  assert.equal(N.reward(1, 0), 0, 'no points, no prize');
  assert.ok(N.reward(1, 1e6) <= 100000, 'within the rules\' cap');
  assert.deepEqual(N.clean({ h: 3, c: 2, d: 1, n: 'X', s: 999 }), { h: 3, c: 2, d: 1, n: 'X', s: 6 }, 's is recomputed');
  assert.equal(N.clean(null), null);
});
