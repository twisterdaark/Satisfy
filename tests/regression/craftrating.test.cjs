'use strict';
// owner 2026-10-22: a rare craft showed up as unique in the bag. A named recipe (rated "fix" for drops and shops) forged by you
// keeps the rating the forge gave it.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('a forged named weapon keeps the rating it came out at', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const G = window.__G, S = G.S; S.lv = 200; S.mats.ore = 99; S.mats.mstone = 99; S.mats.leather = 99;
      const out = []; for (let i = 0; i < 6; i++) { G.startMG('ideal'); G.finishMG()(); const it = S.items[S.items.length - 1]; out.push([it.id, it.r]); }
      const shop = G.eqx.mkItem('ideal', 0).r; return { out, shop }; });
    assert.ok(r.out.every(([id]) => id === 'ideal'), JSON.stringify(r));
    assert.ok(r.out.some(([, rr]) => rr < 3), 'a weak forge is not unique: ' + JSON.stringify(r));
    assert.equal(r.shop, 3, 'outside the forge the named item keeps its rating');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
