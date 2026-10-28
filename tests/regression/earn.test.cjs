'use strict';
// A kill someone else's game made pays you only if you are by the monster when it dies and took a real part (owner 2026-10-23).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('far away: nothing, the monster just dies; near: the XP, and the loot only with a real part', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, P = G.P, X = window.__GPXP, M = G.mons().filter((m) => !m.dead);
      const mk = (dx, myd) => { const m = M.pop(); P.x = m.x - dx; P.y = m.y; m.myd = myd; m.myT = null; return m; };
      const far = mk(900, 1e9);
      const out = { far: X.earn(far), farDead: far.dead };
      const little = mk(50, 1); out.little = X.earn(little); out.littleDead = little.dead; out.noLoot = little.noLoot;
      const real = mk(50, 0); real.myd = real.max * 0.2; out.real = X.earn(real); out.realDead = real.dead;
      out.toasts = [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | ');
      return out;
    });
    assert.deepEqual([r.far, r.farDead, r.little, r.littleDead, r.noLoot, r.real, r.realDead], [false, true, true, false, 1, true, false]);
    assert.match(r.toasts, /too far from the monster/);
    assert.match(r.toasts, /got the XP, but you took too small a part/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
