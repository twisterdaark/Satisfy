'use strict';
// Plan U114 and U139 (2026-10-26): rabbits drop their fur, Snow Rabbits live on the Northern Snowfields, and the Antivenom
// clears poison and keeps it off for 2 minutes.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('Snow Rabbits on the snowfields, rabbit fur, and the Antivenom', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, U = window.__GU114;
      const sr = G.mons().filter((m) => m.type === 'srabbit');
      const out = { n: sr.length, zones: [...new Set(sr.map((m) => U.zone(m.x, m.y)))] };
      out.fur = ['rabbit', 'hrabbit', 'srabbit'].map((k) => U.drops(k).some((d) => d[0] === 'rfur'));
      out.price = U.price('rfur'); out.book = U.book('antidp');
      // the potion: poisoned, drink, clean; a poisonous blow while it lasts does nothing
      S.mats.antidp = 1; P.dotT = U.gt() + 5; P.dotP = 0.02; P.dotC = 'pois';
      U.eat('antidp'); out.cleared = !(P.dotT > U.gt()); out.left = S.mats.antidp; out.buf = P.buf && P.buf.k;
      const mv = { dot: [0.02, 6, 'pois'] }; window.__GM.mx(mv, null); out.blocked = !(P.dotT > U.gt());
      P.buf = null; window.__GM.mx(mv, null); out.after = P.dotT > U.gt() && P.dotC === 'pois';
      return out;
    });
    assert.equal(r.n, 10, 'ten Snow Rabbits');
    assert.deepEqual(r.zones, ['zSnow'], 'on the Northern Snowfields');
    assert.deepEqual(r.fur, [true, true, true], 'every rabbit drops fur');
    assert.equal(r.price, 10); assert.equal(r.book, 'herbW', 'the book at the herbalist');
    assert.equal(r.left, 0);
    assert.equal(r.cleared, true, 'the Antivenom clears poison');
    assert.equal(r.buf, 'antid');
    assert.equal(r.blocked, true, 'no poison takes while it lasts'); assert.equal(r.after, true, 'and does once it is over');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
