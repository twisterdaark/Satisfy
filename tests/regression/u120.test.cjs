'use strict';
// Plan U120 (2026-10-26): the slimes' kinds. Frost Slimes by the glacier lakes resist water and break to thunder; one Gold
// Slime in the marsh runs from you; every slime resists poison by half.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('Frost Slimes and the Gold Slime, and the slimes resist poison', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, P = G.P, U = window.__GU114;
      const fs = G.mons().filter((m) => m.type === 'fslime'), gs = G.mons().filter((m) => m.type === 'gslime');
      const out = { f: fs.length, gl: gs.length, res: [U.res('slime', 'poison'), U.res('fslime', 'water'), U.res('fslime', 'thunder'), U.res('gslime', 'poison')] };
      const m = gs[0]; P.x = m.x - 60; P.y = m.y; P.inv = 1e9;
      return out;
    });
    await g.step(4);
    r.flee = await g.eval(() => (window.__G.mons().find((m) => m.type === 'gslime').flee || 0) > 0);
    assert.equal(r.f, 8); assert.equal(r.gl, 1);
    assert.deepEqual(r.res, [0.5, 0.5, -0.3, 0.5]);
    assert.equal(r.flee, true, 'the Gold Slime runs');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
