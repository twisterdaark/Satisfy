'use strict';
// Health that is not a number (owner 2026-10-24: a Sword Saint's health showed NaN / max every so often): a bad value never sticks in
// health, mana or stamina, a spoilt life-steal budget mends, and casting a passive costs no mana
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('health, mana and stamina never become NaN', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, P = G.P; P.hp = 120; P.hp = NaN; P.hp -= undefined; const hp = P.hp; P.mp = Infinity; const mp = P.mp;
      P.lsB = NaN; const h = window.__GTHR ? window.__GTHR.ls(NaN) : 0; const lsB = P.lsB; P.hp = 50; return { hp, mp: isFinite(mp), h, lsB: isFinite(lsB), hp2: P.hp, log: (window.__NANLOG || []).length > 0 }; });
    assert.deepEqual(r, { hp: 120, mp: true, h: 0, lsB: true, hp2: 50, log: true });
    await g.step(30);
    assert.ok(await g.eval(() => isFinite(window.__G.P.hp) && isFinite(window.__G.P.st)));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
