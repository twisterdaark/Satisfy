'use strict';
// Plan U180 (owner's card 2026-10-26, "eggs only"): a stolen wyvern egg is bound to the thief. It sells to merchants and goes
// into crafts, but the players' auction and the guild vault take only the free ones (the Queen's dropped eggs).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('stolen eggs are bound, dropped ones free', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, U = window.__GP3, eggs = U.WYN.eggs;
      S.mats.wegg = 1;   // one from the Queen
      for (const i of [0, 1]) U.act({ k: 'p3egg', i, x: eggs[i][0] * 16 + 8, y: eggs[i][1] * 16 + 10 });
      const out = { n: S.mats.wegg, bound: U.bound('wegg'), free: U.free('wegg') };
      S.mats.wegg -= 1;  // one sold to a merchant: the bound ones go first
      out.after = [U.bound('wegg'), U.free('wegg')];
      S.mats.wegg = 0; out.none = [U.bound('wegg'), U.free('wegg')];
      out.ore = (S.mats.ore = 5, U.free('ore'));
      return out;
    });
    assert.deepEqual([r.n, r.bound, r.free], [3, 2, 1], 'two stolen bound, the dropped one free');
    assert.deepEqual(r.after, [2, 0], 'what you use counts against the free first, never freeing a stolen one');
    assert.deepEqual(r.none, [0, 0]); assert.equal(r.ore, 5, 'other materials untouched');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
