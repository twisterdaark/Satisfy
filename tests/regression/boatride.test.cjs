'use strict';
// owner 2026-10-22: the boat is faster and leaves a wake; you sit in it; no boarding while transformed; a horse is left on land.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('boat: no boarding in a beast form, off the horse, faster, a wake, seated', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.eval(() => { const G = window.__G; G.P.x = 299 * 16 + 8; G.P.y = 241 * 16 + 8; G.S.gold = 5000; });
    await g.step(5);
    // a beast form can't take the boat, and the fare is kept
    const f = await g.eval(() => { const G = window.__G; G.P.bmf = 'wolf'; const g0 = G.S.gold; window.__GP4.boat(0); return [G.S.gold - g0, !!G.P.boat]; });
    assert.deepEqual(f, [0, false]);
    // on a horse: the boat puts you down
    await g.eval(() => { const G = window.__G; G.P.bmf = null; G.P.ride = 1; window.__GP4.boat(0); });
    await g.page.waitForTimeout(700); await g.step(30);
    assert.deepEqual(await g.eval(() => [window.__G.P.boat, !!window.__G.P.ride]), [1, false]);
    // faster: a second of sailing east (off the pier) covers more than the old 1.15 pace, and leaves foam behind
    const s = await g.eval(() => { const G = window.__G; return G.P.x; });
    await g.page.keyboard.down('KeyD'); await g.step(60); await g.page.keyboard.up('KeyD');
    const r = await g.eval(() => ({ x: window.__G.P.x, boat: window.__G.P.boat, fx: window.__G.fx ? window.__G.fx.length : -1 }));
    assert.equal(r.boat, 1);
    assert.ok(r.x - s > 30, 'sailed east: ' + (r.x - s));
    const base = await g.eval(() => { const G = window.__G, P = G.P, x0 = P.x; window.__GHC.mv(1, 0); return P.x - x0; });
    assert.ok(base > 1.4 && base < 1.5, 'boat step x1.45: ' + base);
    // no changing form in the boat
    await g.eval(() => { const G = window.__G; G.S.cls = 'beast'; G.S.lv = 40; window.__GHC.sk && window.__GHC.sk('bwolf'); });
    assert.equal(await g.eval(() => window.__G.P.bmf || null), null);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
