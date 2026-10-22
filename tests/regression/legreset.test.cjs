'use strict';
// owner 2026-10-22: a legendary class starts over at Lv 1 with every stat at 10 (the smithing bonus too). Gear above Lv 1
// comes off, except for Pagma's Successor, who wears anything (novel ch 11). A Lv 1 does almost nothing to a Lv 130.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function become(cls) {
  const g = await H.openGame({ storage: { satisfy_lang: 'en' } });
  await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
  const r = await g.eval((cls) => {
    const G = window.__G, S = G.S;
    S.lv = 150; S.cls = 'smith'; S.bonus = 418; S.got = { a: 1 };
    S.st = { str: 300, sta: 300, agi: 300, int: 300, dex: 300 };
    S.items.push({ uid: 999, id: 'dains', slot: 'w', r: 4, atk: 400, spd: .52 }); S.eqW = 999;
    window.__GL.become(cls);
    return { lv: S.lv, st: S.st, bonus: S.bonus, eqW: S.eqW, cls: S.cls };
  }, cls);
  return { g, r };
}

test('Pagma: stats back to 10, the smithing bonus gone, gear kept', async () => {
  const { g, r } = await become('pagma');
  try {
    assert.equal(r.cls, 'pagma'); assert.equal(r.lv, 1); assert.equal(r.bonus, 0); assert.equal(r.eqW, 999);
    assert.deepEqual(r.st, { str: 10, sta: 10, agi: 10, int: 10, dex: 10 });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Braham: stats back to 10 and gear above Lv 1 comes off', async () => {
  const { g, r } = await become('braham');
  try {
    assert.equal(r.cls, 'braham'); assert.equal(r.lv, 1); assert.equal(r.bonus, 0); assert.notEqual(r.eqW, 999);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
