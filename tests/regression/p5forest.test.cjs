'use strict';
// Owner 2026-10-21, patch 5 of the third batch: the Mysterious Forest in western Gauss, Pagma's Doppelganger (a world
// boss that splits into shades and takes a third of your damage while they stand), its greatsword, and the pet Randy.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const at = (g, x, y) => g.eval(([x, y]) => { const G = window.__G; G.P.x = x * 16 + 8; G.P.y = y * 16 + 8; G.P.inv = 1e9; G.P.hp = 1e9; }, [x, y]);

test('the forest, its one path from the hermit to the clearing, the hermit and the Doppelganger are on the map', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, X = window.__GP5, M = X.MYF, sol = (x, y) => G.eqx.solid(x, y);
      // walk the open tiles from the hermit to the clearing, inside the forest's box
      const seen = new Set(), q = [[Math.floor(M.npc[0]), Math.floor(M.npc[1]) + 1]];let reach = false;
      while (q.length) { const [x, y] = q.shift(), k = x + ',' + y; if (seen.has(k) || sol(x, y) || x < M.x - M.rx - 2 || x > M.x + M.rx + 2 || y < M.npc[1] - 2 || y > M.y + M.ry) continue; seen.add(k); if (X.clear(x, y)) { reach = true; break; } q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
      let n = 0, s = 0; for (let y = M.y - M.ry + 1; y < M.y + M.ry; y++) for (let x = M.x - M.rx + 1; x < M.x + M.rx; x++) if (X.zone(x, y) && !X.clear(x, y) && Math.abs(x - M.x) > 4) { n++; if (sol(x, y)) s++; }
      return { z: [G.zoneAt(M.x * 16, M.y * 16), G.zoneAt((M.x - 30) * 16, M.y * 16)], d: G.mons().filter((m) => m.type === 'dopp').length,
        np: G.npcs.some((p) => p.id === 'mfher'), clear: sol(M.x, M.y) || sol(M.x + 3, M.y + 1), reach, thick: s / n };
    });
    assert.deepEqual(r.z, ['zMyst', 'zGauss']);
    assert.equal(r.d, 1);
    assert.equal(r.np, true);
    assert.equal(r.clear, false);
    assert.equal(r.reach, true, 'the path reaches the clearing');
    assert.ok(r.thick > 0.7, `the trees are thick (${r.thick})`);
    for (const [x, y] of [[440, 221], [438, 226], [438, 233], [430, 240], [470, 233]]) { await at(g, x, y); await g.step(20); }
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the hermit: reach the clearing, defeat the Doppelganger, and Randy follows you; the guide points into the forest', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const a = await g.eval(() => { const G = window.__G; G.S.lv = 260; G.acceptQ('dp1'); return [G.S.qs.dp1 && G.S.qs.dp1.st, window.__GQG.spot('dp1')]; });
    assert.equal(a[0], 1);
    assert.deepEqual([a[1].x, a[1].y], [438.5, 233.5]);
    await at(g, 438, 233); await g.step(5);
    const b = await g.eval(() => { const G = window.__G; G.completeQ('dp1'); G.acceptQ('dp2'); return [G.S.qs.dp1.st, G.S.qs.dp2 && G.S.qs.dp2.st]; });
    assert.deepEqual(b, [2, 1]);
    const c = await g.eval(() => { const G = window.__G, U = window.__GU, D = G.mons().find((m) => m.type === 'dopp'); U.killMon(D); G.completeQ('dp2');
      return [G.S.qs.dp2.st, !!(U.WS.wb && U.WS.wb.dopp > Date.now())]; });
    assert.deepEqual(c, [2, true]);
    await g.page.waitForTimeout(900); await g.step(10);
    const d = await g.eval(() => { const G = window.__G; return [G.S.pets && G.S.pets.randy, G.S.pet]; });
    assert.deepEqual(d, [1, 'randy']);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the Doppelganger splits into shades: a third of your damage while they stand, more when they fall; shades fade', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await at(g, 438, 230); await g.step(2);
    const r = await g.eval(() => {
      const G = window.__G, U = window.__GU, X = window.__GP5, D = G.mons().find((m) => m.type === 'dopp'), C = () => G.mons().filter((m) => m.type === 'dpcopy' && !m.dead);
      const a0 = X.atk(D); D.eng = 4; X.P5.cpT = 0.01; X.tick(0.02); const n = C().length, a1 = X.atk(D);
      for (const m of C()) U.killMon(m); const a2 = X.atk(D);
      X.copy(D, 2); for (const m of C()) m.life = 0.01; X.tick(0.02); const left = C().length;
      const it = G.eqx.mkItem('dpgs', 4);
      return { a0, n, a1, a2, left, it: [it.id, (it.ip || []).join(), it.lvr || null] };
    });
    assert.equal(r.a0, 1);
    assert.equal(r.n, 2);
    assert.ok(Math.abs(r.a1 - 1 / 3) < 1e-9);
    assert.equal(r.a2, 1);
    assert.equal(r.left, 0);
    assert.equal(r.it[0], 'dpgs');
    for (let i = 0; i < 30; i++) await g.step(2);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Randy copies the skill you just used and swaps places with you when your health falls under 30% in a fight', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await at(g, 300, 200);
    await g.eval(() => window.__GP5.done('dp2'));
    await g.page.waitForTimeout(900); await g.step(10);
    const r = await g.eval(() => {
      const G = window.__G, X = window.__GP5, P = G.P;
      const m = G.spawnMon('wolf', P.x + 20, P.y); m.eng = 4; m.hp = m.max = 1e9;
      const pet = window.__GP5.P5 && G.S.pet;
      P.inv = 0; P.hp = 1e9; X.skc('slash'); X.tick(0.01); const hit = m.hp < 1e9, skT = X.P5.skT > 0;
      return { pet, hit, skT };
    });
    assert.equal(r.pet, 'randy');
    assert.equal(r.hit, true, 'Randy repeats the skill on the monster');
    assert.equal(r.skT, true);
    const s = await g.eval(() => {
      const G = window.__G, X = window.__GP5, P = G.P, max = G.eqx.maxHP ? null : null;
      const before = [P.x, P.y]; X.P5.swT = 0; P.inv = 0; P.hp = 1; X.tick(0.01);
      return { moved: P.x !== before[0] || P.y !== before[1], inv: P.inv };
    });
    assert.equal(s.moved, true, 'swapped places');
    assert.ok(s.inv >= 1.4);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
