'use strict';
// Elites (the player Suki through the owner 2026-10-26): a world monster or boss may spawn as an elite, 50% stronger with
// double experience; every client rolls the same ones, and online the host's flag decides a shared one.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('elite monsters: some in the world, stronger, double XP, the same on every client', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const a = await g.eval(() => { const G = window.__G, E = window.__GELITE, P = G.P;
      const world = G.mons().filter((m) => !m.tmp), el = world.filter((m) => m.elite), bosses = el.filter((m) => window.__G.isk.MT[m.type].boss);
      const m = G.spawnMon('wolf', P.x + 40, P.y); const hp0 = m.max, dm0 = m.dmul || 1, xm0 = m.xmul || 1;
      E.set(m, 1); const on = { max: m.max / hp0, dm: m.dmul / dm0, xm: m.xmul / xm0 };
      E.set(m, 1); const twice = m.max / hp0; E.set(m, 0); const off = { max: m.max / hp0, dm: (m.dmul || 1) / dm0, xm: (m.xmul || 1) / xm0 };
      const f = G.spawnMon('wolf', P.x + 60, P.y); const fmax = f.max; E.set(f, 1, 1);
      return { n: world.length, el: el.length, bosses: bosses.length, on, twice, off, fol: { max: f.max === fmax, dm: f.dmul } }; });
    assert.ok(a.el > 0 && a.el < a.n * 0.08, JSON.stringify(a));
    assert.deepEqual(a.on, { max: 1.5, dm: 1.5, xm: 2 });
    assert.equal(a.twice, 1.5, 'setting it twice changes nothing');
    assert.deepEqual(a.off, { max: 1, dm: 1, xm: 1 });
    assert.deepEqual(a.fol, { max: true, dm: 1.5 }, 'a follower takes the host health as it comes');
    // double the experience on a kill
    const x = await g.eval(() => { const G = window.__G, E = window.__GELITE, C = window.__GC2, P = G.P, S = G.S; S.lv = 1; S.xp = 0;
      const k = (el) => { const m = G.spawnMon('rabbit', P.x + 30, P.y); m.lv = 1; if (el) E.set(m, 1); const x0 = S.xp, l0 = S.lv; m.hp = 1; C.hit(m); return { d: S.xp - x0, up: S.lv - l0 }; };
      return [k(0), k(1)]; });
    assert.equal(x[0].up + x[1].up, 0, JSON.stringify(x));
    assert.equal(x[1].d, x[0].d * 2, JSON.stringify(x));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
