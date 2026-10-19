'use strict';
// tools/cost-model.cjs (doc §28) keeps running against the real contracts, and its main finding holds.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { run } = require(path.join(__dirname, '..', '..', 'tools', 'cost-model.cjs'));

test('cost model: real presence size; the online config and a position-only node both cut downloads', () => {
  const r = run();
  assert.ok(r.updateBytes.json > 150 && r.updateBytes.json < 600, 'presence JSON ' + r.updateBytes.json + ' B');
  const by = Object.fromEntries(r.rows.map((x) => [x.name, x]));
  const before = by['SAT-ONLINE-004 config: 20 players, half moving, 1 s idle heartbeat'], now = by['now (SAT-ONLINE-008): 5 s idle heartbeat'], slim = by['proposal: + position-only updates'];
  assert.ok(now.gbPerHour < before.gbPerHour);
  assert.ok(slim.gbPerHour < now.gbPerHour / 3);
  assert.ok(by['now: 5 friends'].sparkHoursPerMonth > 60, 'five friends fit Spark comfortably');
});
