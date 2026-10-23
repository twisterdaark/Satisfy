'use strict';
// Owner 2026-10-21, patch 2 of the third batch: Sniper, Bowmaster, Battlemage and Warlock (plan U072, U073, U078, U079) and
// the hidden Demon Slayer and Saintess paths (U087, U088).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
// a class with its weapon, a level, and a lone tough monster ahead (to the right)
const setup = (g, cls, lv, wk, ty) => g.eval(([cls, lv, wk, ty]) => {
  const G = window.__G, S = G.S, P = G.P; S.cls = cls; S.lv = lv; P.inv = 1e9; P.hp = 1e9; P.mp = 1e6; P.x = 90 * 16; P.y = 60 * 16; P.dir = 2;
  const id = { bow: 'bow', staff: 'staff', sword: 'isword' }[wk]; const it = G.eqx.mkItem(id, 1); S.items.push(it); S.eqW = it.uid;
  for (const m of G.mons()) { m.dead = true; m.rt = 1e9; }
  const m = G.spawnMon(ty || 'wolf', P.x + 40, P.y); m.max = m.hp = 1e9; m.lv = lv; m.tmp = 0; window.__m = m; return G.mons().indexOf(m);
}, [cls, lv, wk, ty]);

test('the trainers offer the new paths: Sniper and Bowmaster to an Archer, Battlemage and Warlock to a Mage', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, C = window.__GC2; S.lv = 30; S.mast = S.mast || {};
      const av = (cls) => { S.cls = cls; return ['c2s', 'c2m', 'c2g', 'c2w', 'c2r'].filter((q) => C.avail(q)); };
      return { archer: av('archer'), mage: av('mage'), warrior: av('warrior'), mst: C.mstOk(G.QD.c2s) };
    });
    assert.deepEqual(r.archer, ['c2s', 'c2m', 'c2r']);
    assert.deepEqual(r.mage, ['c2g', 'c2w']);
    assert.deepEqual(r.warrior, []);
    // the trial gives the class and keeps the old skills
    const k = await g.eval(() => { const G = window.__G, S = G.S, C = window.__GC2; S.cls = 'mage'; C.accept('c2w'); S.qs.c2w.c = 15; C.complete('c2w'); return [S.cls, S.cbase, C.cls().includes('fireball'), C.cls().includes('wlrot')]; });
    assert.deepEqual(k, ['warlock', 'mage', true, true]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Sniper: the charged shot fires after 1.2 s standing still, and nothing comes of it when you move or are hit', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await setup(g, 'sniper', 40, 'bow');
    // the wolf is held in place so the line of the shot stays on it
    await g.eval(() => { window.__m.stun = 1e9; window.__GP2.sk('snshot'); });
    await g.step(90);
    assert.ok(await g.eval(() => window.__m.hp < 1e9), 'the shot landed');
    await g.eval(() => { window.__m.hp = 1e9; window.__GP2.sk('snshot'); });
    await g.step(20);
    await g.eval(() => window.__GP2.hurt(10, window.__m));
    await g.step(80);
    assert.equal(await g.eval(() => window.__m.hp), 1e9, 'a blow breaks the aim: no damage');
    await g.eval(() => window.__GP2.sk('snshot'));
    await g.step(20);
    await g.page.keyboard.down('KeyS'); await g.step(10); await g.page.keyboard.up('KeyS');
    await g.step(80);
    assert.equal(await g.eval(() => window.__m.hp), 1e9, 'moving breaks the aim: no damage');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Bowmaster: combo stacks on one target, and an arrow never hits the same monster twice', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await setup(g, 'bowmaster', 40, 'bow');
    const r = await g.eval(() => { const m = window.__m, G = window.__G; for (let i = 0; i < 7; i++) window.__GC2.hit(m); return [G.P.bmc, window.__GP2.atk(m)]; });
    assert.equal(r[0], 5);
    assert.ok(Math.abs(r[1] - 1.2) < 1e-9, String(r[1]));
    const hits = await g.eval(() => { const G = window.__G; window.__GP2.sk('bmstorm'); return 0; });
    await g.step(120);
    const ok = await g.eval(() => window.__G.proj.every((p) => p.kind !== 'arrow' || p.hit.size <= 1));
    assert.ok(ok);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Battlemage: Mana Blade gives back MP; Arcane Armor stops MP refilling and cuts damage', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await setup(g, 'bmage', 40, 'staff');
    const r = await g.eval(() => { const G = window.__G, P = G.P; P.mp = 10; window.__GP2.sk('bgblade'); return [P.mp, window.__m.hp < 1e9]; });
    assert.deepEqual(r, [13, true]);
    const a = await g.eval(() => { const G = window.__G, P = G.P; P.mp = 50; window.__GP2.sk('bgarmor'); return window.__GP2.hurt(100, null); });
    assert.equal(a, 80);
    await g.step(60);
    assert.ok(await g.eval(() => window.__G.P.mp < 50), 'the armor drains MP instead of it refilling');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Warlock: rot ticks, the curse adds 15% and is shaken off by a boss phase; rot ends in a town', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await setup(g, 'warlock', 40, 'staff');
    await g.eval(() => { window.__GP2.sk('wlcurse'); window.__GP2.sk('wlrot'); });
    assert.ok(await g.eval(() => window.__m.wlc > 0 && !!window.__m.rot));
    assert.ok(Math.abs(await g.eval(() => window.__GP2.atk(window.__m)) - 1.15) < 1e-9);
    await g.step(150);
    assert.ok(await g.eval(() => window.__m.hp < 1e9), 'the rot hurt it');
    // in a town (a safe zone) the rot stops
    const town = await g.eval(() => { const G = window.__G, T = G.TOWNS[0], m = window.__m; m.x = (T.x0 + 2) * 16; m.y = (T.y0 + 2) * 16; window.__GP2.tick(1 / 60); return [!!m.rot, window.__GP2.P2.rot.length]; });
    assert.deepEqual(town, [false, 0]);
    // a boss in a new phase shakes the curse off
    const b = await g.eval(() => { const m = window.__m; m.wlc = 5; m.wlPh = 0; m.ph = 1; window.__GP2.tick(1 / 60); return m.wlc; });
    assert.ok(b > 0, 'not a boss: the curse holds');
    const b2 = await g.eval(() => { const G = window.__G, P = G.P, m = G.spawnMon('gchief', P.x + 60, P.y); m.wlc = 5; m.wlPh = 0; m.ph = 1; window.__GP2.tick(1 / 60); return m.wlc; });
    assert.equal(b2, 0);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Demon Slayer and Saintess: offered by their hidden conditions; demon bonuses cap at +60%; Second Life once per 10 minutes', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const o = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GP2, H = window.__GHC.s(); S.cls = 'knight'; S.lv = 180; H.dm = 49; const a = X.offerK(); H.dm = 50; const b = X.offerK();
      S.lv = 40; S.cls = 'priest'; S.qs.es1 = { st: 2 }; S.qs.es2 = { st: 2 }; const c = X.offerK(); S.cls = 'pagma'; const d = X.offerK(); return [a, b, c, d];
    });
    assert.deepEqual(o, [null, 'hds', 'hsa', null]);
    await setup(g, 'dslayer', 200, 'sword', 'demon');
    const k = await g.eval(() => { const m = window.__m, X = window.__GP2; const a = X.atk(m); m.dss = 5; return [a, X.atk(m), X.atk(m, { dem: 1.5 })]; });
    // v1.92: Weapons Mastery adds 10% on top of the demon bonuses
    assert.ok(Math.abs(k[0] - 1.32) < 1e-9 && Math.abs(k[1] - 1.584) < 1e-9 && Math.abs(k[2] - 1.76) < 1e-9, JSON.stringify(k));
    assert.equal(await g.eval(() => window.__GP2.hurt(100, window.__m)), 75);
    const l = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, X = window.__GP2; S.cls = 'saintess'; S.lv = 50; window.__GHC.s().saT = 0; const a = X.life(); P.hp = 0; const b = X.life(); return [a, b, P.hp]; });
    assert.equal(l[0], true);
    assert.equal(l[1], false, 'not twice within 10 minutes');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
