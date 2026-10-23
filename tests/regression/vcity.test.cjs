'use strict';
// Owner 2026-10-23: the Vampire's Underground Cities from the novel (ch 259-730), cities 15 to 7 under the desert south
// of Reidan. An ant hill leads down; inside, the way up and the way down stay sealed until the city's master dies.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const toasts = (g) => g.eval(() => {
  if (!window.__toastLog) { window.__toastLog = [...document.querySelectorAll('#toasts .toast')].map((e) => e.textContent); new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__toastLog.push(n.textContent); }).observe(document.getElementById('toasts'), { childList: true }); }
  return window.__toastLog.join(' | ');
});
const gate = (g, q) => g.eval((q) => { const G = window.__G, X = window.__GVC, d = G.eqx.DGATES.find((d) => d.vc === q.vc && !!d[q.k]); if (!d) return null; G.eqx.useGate(d); return { x: d.to.x, y: d.to.y }; }, q);
const spot = (g) => g.eval(() => { const G = window.__G, C = window.__GVC.at(G.P.x / 16, G.P.y / 16); return [C ? C.n : 0, G.zoneAt(G.P.x, G.P.y)]; });
const go = async (g, q) => { const to = await gate(g, q); await g.page.waitForTimeout(700); await g.step(30); return to; };

test('fifteen cities below the desert, each walkable from its cave to the way down, with their people and masters', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, X = window.__GVC, sol = (x, y) => G.eqx.solid(x, y), out = [];
      for (const C of X.VC) {
        const seen = new Set(), q = [[C.x0 + 5, C.ym]]; let hall = false, down = false;
        while (q.length) { const [x, y] = q.shift(), k = x + ',' + y; if (seen.has(k) || sol(x, y) || x < C.x0 || x > C.x1 || y < C.y0 || y > C.y1) continue; seen.add(k);
          if (Math.abs(x - (C.x1 - 3)) <= 1 && Math.abs(y - C.ym) <= 1) down = true; if (x > C.mx + 2 && Math.abs(y - C.ym) < 3) hall = true; q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
        const ms = G.mons().filter((m) => { const c = X.at(m.x / 16, m.y / 16); return c && c.n === C.n; });
        out.push({ n: C.n, z: G.zoneAt((C.x0 + 30) * 16, C.ym * 16), hall, down, mons: ms.length, masters: X.VCMS.filter((o) => o.n === C.n).length });
      }
      return { out, ant: !!G.eqx.DGATES.find((d) => d.ant), gates: G.eqx.DGATES.filter((d) => d.vc).length };
    });
    assert.equal(r.out.length, 15);
    assert.equal(r.ant, true);
    assert.equal(r.gates, 1 + 15 * 3); // up, down and the red return stone
    for (const c of r.out) {
      assert.equal(c.z, 'zVc' + c.n);
      assert.ok(c.hall && c.down, `city ${c.n} walks through to the master and the way down`);
      assert.ok(c.mons >= 18, `city ${c.n} has its people (${c.mons})`);
      assert.equal(c.masters, c.n === 7 ? 4 : 1);
    }
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the ant hill leads to the 15th city; the ways stay sealed until its master dies, then open up and down', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await toasts(g);
    await g.eval(() => { const G = window.__G; G.S.lv = 260; G.P.inv = 1e9; G.P.hp = 1e9; });
    const to = await g.eval(() => { const G = window.__G, d = G.eqx.DGATES.find((d) => d.ant); G.P.x = d.x; G.P.y = d.y; G.eqx.useGate(d); return d.to; });
    await g.page.waitForTimeout(700); await g.step(30);
    assert.deepEqual(await spot(g), [15, 'zVc15']);
    assert.match(await toasts(g), /Underground City \(15\)/);
    // sealed: neither way moves you
    await go(g, { vc: 15, k: 'vup' }); await go(g, { vc: 15, k: 'vdown' });
    assert.deepEqual((await spot(g))[0], 15);
    assert.match(await toasts(g), /The way is sealed/);
    // the master: seen alive, then dead
    const k = await g.eval(() => { const G = window.__G, X = window.__GVC, o = X.VCMS.find((o) => o.n === 15); G.P.x = o.m.x - 100; G.P.y = o.m.y; for (const m of G.mons()) if (m !== o.m) { m.dead = true; m.rt = 1e9; } return o.m.type; });
    assert.equal(k, 'vb15');
    await g.step(10);
    assert.match(await toasts(g), /The master of city 15, True Blood Baron/);
    await g.eval(() => { const G = window.__G, o = window.__GVC.VCMS.find((o) => o.n === 15); window.__GU.killMon(o.m); });
    await g.step(10); await g.page.waitForTimeout(1000); await g.step(5);
    assert.equal(await g.eval(() => window.__GVC.done(15)), true);
    assert.match(await toasts(g), /The entrance has been released/);
    await go(g, { vc: 15, k: 'vdown' });
    assert.deepEqual(await spot(g), [14, 'zVc14']);
    await go(g, { vc: 14, k: 'vup' });
    assert.deepEqual((await spot(g))[0], 14, 'the 14th city is still sealed');
    await g.eval(() => window.__GVC.clear(14));
    await go(g, { vc: 14, k: 'vup' });
    assert.deepEqual((await spot(g))[0], 15);
    await go(g, { vc: 15, k: 'vup' });
    const s = await spot(g);
    assert.equal(s[0], 0, 'back on the sand');
    assert.equal(await g.eval(() => window.__G.S.vc.c[15]), 1);
    // the 7th city: its way down leads on to the 6th once its masters are dead (the rest is in vcback)
    await g.eval(() => { for (const n of [13, 12, 11, 10, 9, 8, 7]) window.__GVC.clear(n); });
    await go(g, { vc: 8, k: 'vdown' });
    assert.deepEqual((await spot(g))[0], 7);
    await go(g, { vc: 7, k: 'vdown' });
    assert.deepEqual((await spot(g))[0], 6);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Latina halves your attack and slows you near her; Tiramet comes back at half health once a life', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const near = (t, dx) => g.eval(([t, dx]) => { const G = window.__G, X = window.__GVC, o = X.VCMS.find((o) => o.m.type === t); G.P.x = o.m.x + dx; G.P.y = o.m.y; G.P.inv = 1e9; G.P.hp = 1e9; }, [t, dx]);
    await near('vlatina', -60); await g.step(5);
    assert.deepEqual(await g.eval(() => [window.__GVC.atk(), window.__GVC.spd()]), [0.5, 0.7]);
    await near('vlatina', -400); await g.step(5);
    assert.deepEqual(await g.eval(() => [window.__GVC.atk(), window.__GVC.spd()]), [1, 1]);
    await near('vtira', -100); await g.step(3);
    const hp = await g.eval(() => { const o = window.__GVC.VCMS.find((o) => o.m.type === 'vtira'); o.m.hp = Math.round(o.m.max * 0.4); return o.m.max; });
    await g.step(3);
    const a = await g.eval(() => window.__GVC.VCMS.find((o) => o.m.type === 'vtira').m.hp);
    assert.ok(a >= hp * 0.75, `Tiramet came back (${a}/${hp})`);
    await g.eval(() => { const o = window.__GVC.VCMS.find((o) => o.m.type === 'vtira'); o.m.hp = Math.round(o.m.max * 0.3); });
    await g.step(3);
    const b = await g.eval(() => window.__GVC.VCMS.find((o) => o.m.type === 'vtira').m.hp);
    assert.ok(b < hp * 0.4, 'only once a life');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
