'use strict';
// tools/cost-model.cjs (doc §28) keeps running against the real contracts, and its main finding holds.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { run } = require(path.join(__dirname, '..', '..', 'tools', 'cost-model.cjs'));

test('cost model: real presence size; the 5 s heartbeat and sending only changed fields both cut downloads', () => {
  const r = run();
  assert.ok(r.updateBytes.json > 150 && r.updateBytes.json < 600, 'presence JSON ' + r.updateBytes.json + ' B');
  const by = Object.fromEntries(r.rows.map((x) => [x.name, x]));
  const before = by['SAT-ONLINE-004 config: 20 players, half moving, 1 s idle heartbeat'], now = by['now (SAT-ONLINE-008): 5 s idle heartbeat'], slim = by['now (SAT-ONLINE-011): only changed fields'];
  assert.ok(now.gbPerHour < before.gbPerHour);
  assert.ok(slim.gbPerHour < now.gbPerHour / 3);
  assert.ok(by['now: 5 friends'].sparkHoursPerMonth > 60, 'five friends fit Spark comfortably');
});

test('cost model: interest management (U009) pays for its re-queries and makes 100 players possible', () => {
  const by = Object.fromEntries(run().rows.map((x) => [x.name, x]));
  const slim = by['now (SAT-ONLINE-011): only changed fields'], near = by['now (SAT-ONLINE-014): 20 players, 5 within 800 px'];
  assert.equal(near.k, 5);
  assert.ok(near.gbPerHour < slim.gbPerHour / 2.5, `${near.gbPerHour} vs ${slim.gbPerHour}`);
  const big = by['now (SAT-ONLINE-014): 100 players (Spark cap), 10 within 800 px'], all = by['without interest: 100 players'];
  assert.ok(big.gbPerHour < all.gbPerHour / 5);
  assert.ok(all.sparkHoursPerMonth < 1, 'a full shard without it would not last an hour a month');
});
