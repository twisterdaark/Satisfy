'use strict';
// The arena, the Tower of Trials and the solo instances all use DUN[8]; new dungeon floors go after it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('../harness/load-module.cjs');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

test('DUN[8] is the arena (startArena, startTower and solo use DUN[8])', () => {
  const lit = html.match(/const DUN=\[(.*?)\];/);
  assert.ok(lit, 'DUN literal not found');
  const ks = [...lit[1].matchAll(/k:'(\w+)'/g)].map((m) => m[1]);
  assert.equal(ks[8], 'zArena', 'DUN order: ' + ks.join(','));
});
