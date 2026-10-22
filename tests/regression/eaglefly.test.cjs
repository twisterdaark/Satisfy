'use strict';
// owner 2026-10-22: the Beast Master's eagle flies over water (and trees); it cannot land over them, and on foot water still stops you.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the eagle crosses water; it cannot land there; walking does not', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, X = window.__GHC, TS = 16, WA = 4;
      // a water tile with dry land to its west
      let spot = null; for (let y = 20; y < 250 && !spot; y++) for (let x = 20; x < 900 && !spot; x++) if (G.at(x, y) === WA && G.at(x + 1, y) === WA && G.at(x + 2, y) === WA && G.at(x - 1, y) !== WA && G.at(x - 2, y) !== WA && !G.eqx.solid(x - 2, y) && !G.eqx.solid(x - 1, y)) spot = [x, y];
      const sx = (spot[0] - 2) * TS + 8, sy = spot[1] * TS + 8;
      S.cls = 'beast'; S.lv = 40; P.bmf = null; P.x = sx; P.y = sy; for (let i = 0; i < 40; i++) X.mv(1, 0); const walk = P.x;
      P.x = sx; P.y = sy; P.bmf = 'eagle'; for (let i = 0; i < 40; i++) X.mv(1, 0); const fly = P.x;
      X.sk('beagle'); const still = P.bmf; return { sx, walk, fly, still }; });
    assert.ok(r.walk < r.sx + 30, 'on foot the water stops you: ' + JSON.stringify(r));
    assert.ok(r.fly >= r.sx + 39, 'the eagle flies on: ' + JSON.stringify(r));
    assert.equal(r.still, 'eagle', 'no landing over water');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
