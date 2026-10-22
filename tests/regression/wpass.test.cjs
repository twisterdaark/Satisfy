'use strict';
// Weapon passives (owner 2026-10-22): an epic weapon rolls one random passive, unique two, legendary three, and a hidden
// function found by appraisal can add one more. They show in the tooltip and work while the weapon is held.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('epic and better weapons roll passives, appraisal can add a hidden one', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const X = window.__G.isk, A = window.__GAP;
      const n = [0, 1, 2, 3, 4].map((q) => (X.mkItem('isword', q).wp || []).length);
      const it = X.mkItem('isword', 4), tip = X.itemTip(it);
      let hid = 0; for (let i = 0; i < 60; i++) { const w = X.mkItem('isword', 1); window.__G.S.gold = 1e9; A.doApr(w, 'anvil'); if ((w.wp || []).some((p) => p.h)) hid++; }
      return { n, kinds: new Set(it.wp.map((p) => p.k)).size, tip, hid }; });
    assert.deepEqual(r.n, [0, 0, 1, 2, 3]);
    assert.equal(r.kinds, 3, 'no passive twice on one weapon');
    assert.equal((r.tip.match(/◆/g) || []).length, 3);
    assert.ok(r.hid > 0, 'a hidden function turned into a passive at least once in 60 appraisals');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// owner 2026-10-22: something to keep an enhancement from dropping. A Protection Stone keeps the level on a failure,
// a Blessing Stone adds 10% to the odds; each is used up by the try.
test('a Protection Stone keeps the enhancement level when a try fails', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(async () => { const G = window.__G, S = G.S, X = G.eqx;
      S.gold = 1e12; S.mats.mstone = 999; S.mats.estone = 999; S.mats.pstone = 8;
      const w = S.items.find((i) => i.slot === 'w'); w.en = 9; const lv = [];
      for (let i = 0; i < 8; i++) { X.enhance(w, 'smith', { pr: 1 }); lv.push(w.en); }
      return { lv, left: S.mats.pstone }; });
    assert.equal(r.left, 0, 'each try uses one stone');
    assert.ok(r.lv.every((n) => n >= 9), 'never below +9: ' + r.lv.join(','));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
