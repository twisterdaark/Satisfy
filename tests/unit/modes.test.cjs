'use strict';
// Review fix (#10, #23): online, the player stays published (and a duel stays live) on every screen of a running game.
// main adds screens now and then (the quest panel 'qd', the guild-name box, controls, the enhancement moment), so this
// reads every mode the game sets and checks NET_LIVE covers all of them except the ones outside a game.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('../harness/load-module.cjs');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const OUTSIDE = ['title', 'create'];

test('NET_LIVE lists every in-game mode', () => {
  const live = JSON.parse(/const NET_LIVE=(\[[^\]]*\]);/.exec(html)[1].replace(/'/g, '"'));
  const modes = [...new Set([...html.matchAll(/\bmode='([a-z]+)'/g)].map((m) => m[1]))];
  assert.ok(modes.includes('play') && modes.includes('qd'), 'modes found: ' + modes);
  assert.deepEqual(modes.filter((m) => !OUTSIDE.includes(m) && !live.includes(m)), []);
});
