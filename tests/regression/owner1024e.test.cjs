'use strict';
// The training dummies stand where they were put, whatever hits them (owner 2026-10-24: they moved when hit)
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('a training dummy does not move', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, T = window.__GTD, [tx, ty] = T.TDSPOT[0], P = G.P; P.x = tx * 16 + 30; P.y = ty * 16; T.tick(1 / 60);
      const m = G.mons().find((q) => q.tdum && q.sx === tx * 16); if (!m) return null; m.x += 40; m.y += 12; m.mds = { vx: 200, vy: 0, t: 1 }; T.tick(1 / 60); return [m.x - m.sx, m.y - m.sy, m.mds]; });
    assert.deepEqual(r, [0, 0, null]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
