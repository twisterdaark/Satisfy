'use strict';
// Plan U192 (2026-10-26): Regas's drill before the golems: four dodges and four parries against his telegraphed blows.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test("Regas's drill counts dodges and parries against him only, and completes the quest", async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, R = window.__GRGD, B = window.__GPB7;
      S.lv = 95; S.qs.gj2 = { st: 2 }; S.qs.gjd = { st: 1, c: 0 };
      R.start(); const m = R.spar(); const out = { spar: !!(m && m.drill), name: m && m.nm };
      // a blow from another monster while dashing does not count
      const other = G.mons().find((x) => !x.dead && !x.tmp && x !== m);
      P.dash = .1; B.hurt(100, other); out.other = m.drill.dg;
      // dodging his blows: four count, spaced apart
      for (let i = 0; i < 6; i++) { P.dash = .1; P.inv = 0; m.drill.nx = 0; B.hurt(100, m); }
      out.dg = m.drill.dg; P.dash = 0; P.inv = 0; P.dcd = 0;
      // parries: the guard raised toward him just now
      for (let i = 0; i < 4; i++) { P.inv = 0; P.guard = 1; P.gT = 0; P.gx = Math.sign(m.x - P.x) || 1; P.gy = 0; m.drill.nx = 0; B.hurt(100, m); }
      out.c = S.qs.gjd.c; out.gone = !G.mons().includes(m);
      return out;
    });
    assert.equal(r.spar, true); assert.equal(r.name, 'Regas');
    assert.equal(r.other, 0, 'only his blows count');
    assert.equal(r.dg, 4, 'four dodges, no more');
    assert.equal(r.c, 1, 'the drill completes the quest'); assert.equal(r.gone, true, 'and Regas steps back');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
