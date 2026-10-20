'use strict';
// Owner 2026-10-20: "add achievements and things for exploring the map and drawing it, so wandering really pays off".
// A first visit to a region pays experience and Cartography; seeing most of a region charts it (gold, a check on the map);
// explorer caches lie in every region outside towns and dig up once each.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('regions found, charted and caches dug up', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, X = window.__GX, S = G.S, out = {};
      const grid = X.grid(), caches = X.caches();
      out.regions = grid.k.length;
      // every region outside towns with some land has a cache
      out.noCache = grid.k.filter((k, i) => grid.n[i] >= 4 && !G.world().TOWNS.some((T) => T.k === k) && !caches.some((c) => c.z === k));
      const c = caches.find((q) => q.z === 'zGrey');
      G.P.x = c.x + 20; G.P.y = c.y;
      // a first visit
      const xp0 = S.xp + S.lv * 1e9, cl0 = (S.life || {}).carto || 0;
      X.zone('zGrey');
      out.found = !!S.exd.zGrey; out.xp = S.xp + S.lv * 1e9 > xp0; out.carto = (S.life.carto || 0) > cl0;
      const xp1 = S.xp + S.lv * 1e9; X.zone('zGrey'); out.once = S.xp + S.lv * 1e9 === xp1;
      // charting
      const g0 = S.gold; X.fill('zGrey'); X.seen(1);
      out.charted = !!S.exc.zGrey; out.chartGold = S.gold > g0;
      // the cache: seen only near, dug up once
      out.near = X.near().some((q) => q.id === c.id);
      const g1 = S.gold; X.dig(c); out.dug = S.gold > g1 && !!S.exf[c.id];
      const g2 = S.gold; X.dig(c); out.digOnce = S.gold === g2;
      out.gone = !X.near().some((q) => q.id === c.id);
      G.P.x += 400; out.far = X.near().length === 0;
      return out;
    });
    assert.ok(r.regions > 40, 'regions ' + r.regions);
    assert.deepEqual(r.noCache, []);
    for (const k of ['found', 'xp', 'carto', 'once', 'charted', 'chartGold', 'near', 'dug', 'digOnce', 'gone']) assert.ok(r[k], k);
  } finally { await g.close(); }
});
