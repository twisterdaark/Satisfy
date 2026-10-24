'use strict';
// U222 Fish market and U223 Crop wholesale market (SAT-ONLINE-190; checks: "players can't sell non-existent fish", "farming
// cannot print infinite Gold"):
//   - fish and produce sell at their species' price up to the day's quota, then for less, and none past five quotas;
//   - the price shown in the bag is the next one's; only what is in the bag can be sold;
//   - a new world day: full price again; the day's counts stay in the save through a reload.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const sell = (g, k, all) => g.eval(([k, all]) => { const B = window.__G.bag(), i = B.INVS.findIndex((s) => !s.it && s.k === k); if (i < 0) return null; B.invClick(i, all); return true; }, [k, all]);
const shown = (g, k) => g.eval((k) => { const B = window.__G.bag(), s = B.INVS.find((s) => !s.it && s.k === k); return s ? B.unitVal(s) : null; }, k);

test('the market: full price to the quota, less past it, none past five quotas, a new day, kept in the save', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g, LOOK);
    await g.eval(() => { const G = window.__G; G.S.mats.melon = 100; G.S.mats.fish = 3; G.S.gold = 0; G.bag().openSell('smith'); });
    await g.step(2);
    const Q = await g.eval(() => window.__GMK.Q.melon), P = 160;
    assert.equal(await shown(g, 'melon'), P, 'full price at first');
    // one, then the rest: the quota at full price, then less, and they stop at five quotas
    await sell(g, 'melon', false);
    assert.deepEqual(await g.eval(() => [window.__G.S.gold, window.__G.S.mats.melon, window.__GMK.S.n.melon]), [P, 99, 1]);
    await sell(g, 'melon', true);
    let want = 0; for (let i = 1; i < Q * 5; i++) want += i < Q ? 1 : Math.max(0.1, Q / (i + 1));
    const r = await g.eval(() => [window.__G.S.gold, window.__G.S.mats.melon, window.__GMK.S.n.melon]);
    assert.deepEqual(r, [P + Math.round(P * want), 100 - Q * 5, Q * 5]);
    assert.ok(r[0] < 100 * P * 0.6, 'a hundred melons fetch far less than a hundred times the price: ' + r[0]);
    // the market is full: nothing sold, nothing paid, the melons stay in the bag
    await sell(g, 'melon', true);
    assert.deepEqual(await g.eval(() => [window.__G.S.gold, window.__G.S.mats.melon]), [r[0], 100 - Q * 5]);
    // another kind has its own quota
    await sell(g, 'fish', true);
    assert.deepEqual(await g.eval(() => [window.__G.S.gold - 0, window.__G.S.mats.fish || 0]), [r[0] + 12, 0]);
    assert.equal(await sell(g, 'fish', true), null, 'no fish left to sell');
    // a reload and Continue: still full today
    await g.eval(() => window.__G.save(true));
    await g.page.reload(); await g.step(2); await H.continueGame(g);
    assert.equal(await g.eval(() => window.__GMK.S.n.melon), Q * 5, 'kept in the save');
    // the next world day: full price again
    await g.eval(() => { const real = Date.now; Date.now = () => real() + 86400000; });
    await g.eval(() => window.__G.bag().openSell('smith')); await g.step(2);
    assert.equal(await shown(g, 'melon'), P);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
