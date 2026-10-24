'use strict';
// Braham's Alarm Spell (owner 2026-10-24): a circle that rings once for each foe crossing it: held, slowed, struck for 150%
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test("Braham's Successor lays an alarm circle that rings once per foe", async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P; S.cls = 'braham'; S.lv = 200;
      S.items.push(G.eqx.mkItem('staff', 0)); S.eqW = S.items[S.items.length - 1].uid; P.mp = 9999;
      const has = window.__GSK.keys().includes('balarm'); window.__GPF.cast('balarm'); const A = window.__GBAL.A.length;
      const m = G.spawnMon('wolf', P.x + 400, P.y); const hp0 = m.hp; window.__GBAL.tick(.1); const outside = m.hp === hp0;
      m.x = P.x + 30; m.y = P.y; window.__GBAL.tick(.1); const hp1 = m.hp; window.__GBAL.tick(.1);
      return { has, A, outside, hit: hp1 < hp0, stun: m.stun > 0, once: m.hp === hp1 }; });
    assert.deepEqual(r, { has: true, A: 1, outside: true, hit: true, stun: true, once: true });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
