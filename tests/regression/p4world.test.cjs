'use strict';
// Owner 2026-10-21, patch 4 of the third batch: Farming 2 with seasons, compost and the Legendary Farmer trial (plan
// U091-U093), Pedro Harbor, boats and the Kraken (U165, U137), the Bard, the dance floor and the stage's music pads
// (U113, U293, U294).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const at = (g, x, y) => g.eval(([x, y]) => { const G = window.__G; G.P.x = x * 16 + 8; G.P.y = y * 16 + 8; G.P.inv = 1e9; G.P.hp = 1e9; }, [x, y]);

test('the field, the harbor, Cork Island, the Kraken and the stage are on the map, with their people', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, X = window.__GP4, n = {};
      for (const m of G.mons()) n[m.type] = (n[m.type] || 0) + 1;
      return { z: [G.zoneAt(300 * 16, 236 * 16), G.zoneAt(640 * 16, 262 * 16), G.zoneAt(696 * 16, 262 * 16)], kr: n.kraken, np: ['hbm', 'hbm2', 'minst'].filter((id) => G.npcs.some((p) => p.id === id)),
        pier: G.eqx.solid(300, 250), sea: X.sea(304, 256), stage: G.eqx.solid(381, 77) };
    });
    assert.deepEqual(r.z, ['zHarbor', 'zCork', 'zKraken']);
    assert.equal(r.kr, 1);
    assert.deepEqual(r.np, ['hbm', 'hbm2', 'minst']);
    assert.deepEqual([r.pier, r.sea, r.stage], [false, true, false]);
    for (const [x, y] of [[291, 72], [300, 240], [641, 260], [381, 80], [300, 258], [696, 250]]) { await at(g, x, y); await g.step(20); }
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Farming 2: seed and harvest, out of season at half speed, compost makes it quicker and bigger, the bin takes three herbs', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GP4, s = X.season(), C = X.CROPS;
      const inS = Object.keys(C).find((c) => C[c].s.includes(s)), outS = Object.keys(C).find((c) => !C[c].s.includes(s));
      const f = (c, cmp) => X.grow(c, cmp) / (C[c].m * 60000);
      S.gold = 1000; S.mats.herb = 4; X.compost(); const bin = [S.mats.herb, S.mats.compost];
      X.plant(0, inS); const p = X.s().pl[0], g0 = S.gold;
      X.act({ k: 'p4plot', i: 0 }); const early = S.mats[inS] || 0;
      p.t0 -= p.d; X.act({ k: 'p4plot', i: 0 });
      return { f: [f(inS), f(outS), f(inS, 1)], y: [X.yld(inS), X.yld(outS), X.yld(inS, 1)], n: [C[inS].n, C[outS].n], bin, cmp: [p.cmp, S.mats.compost], g0, early, got: S.mats[inS], pn: p.n, empty: X.s().pl[0] };
    });
    assert.deepEqual(r.f, [1, 2, 0.6]);
    assert.deepEqual(r.y, [r.n[0], r.n[1] - 1, r.n[0] + 1]);
    assert.deepEqual(r.bin, [1, 1]);
    assert.deepEqual(r.cmp, [1, 0], 'the compost went in with the seed');
    assert.equal(r.early, 0, 'nothing to harvest before it has grown');
    assert.equal(r.got, r.pn);
    assert.equal(r.empty, null);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Legendary Farmer: four kinds harvested, then the Legendary Field with four digs gives the title, and crops grow faster', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GP4, U = window.__GU; S.lv = 40; S.gold = 1e6;
      S.sec = 'farmer'; G.acceptQ('lfa1');
      ['wheat', 'straw', 'melon', 'pumpk'].forEach((c, i) => { X.plant(i, c); const p = X.s().pl[i]; p.t0 -= p.d; X.harvest(i); });
      const c1 = S.qs.lfa1.c; G.completeQ('lfa1'); G.acceptQ('lfa2');
      const opt = X.piaro().length; X.lfield(); const F = U.getFARM(), left = F.left; F.cx = F.sx; F.cy = F.sy; U.farmDig();
      const c2 = S.qs.lfa2.c; G.completeQ('lfa2');
      return { c1, opt, left, lf: F.lf, c2, tl: S.tl.lfarm, f: X.grow('wheat', 0) / (X.CROPS.wheat.m * 60000 * (X.CROPS.wheat.s.includes(X.season()) ? 1 : 2)) };
    });
    assert.equal(r.c1, 4);
    assert.equal(r.opt, 3, 'Piaro offers the season, the Legendary Field and the harvest fair');
    assert.deepEqual([r.left, r.lf], [4, 1]);
    assert.equal(r.c2, 1);
    assert.equal(r.tl, 1);
    assert.ok(Math.abs(r.f - 0.48) < 1e-9, String(r.f));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the harbor: the ferry to Cork Island, a boat that keeps to the sea and lands you on a beach, no riding in a boat', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await at(g, 299, 241);
    // the fare is taken at once (charting a new place on arrival pays its own gold)
    assert.equal(await g.eval(() => { window.__G.S.gold = 1000; window.__GP4.ferry(0); return window.__G.S.gold; }), 700);
    await g.page.waitForTimeout(700); // the fade runs on a real timer
    await g.step(80);
    const f = await g.eval(() => { const G = window.__G; return [Math.floor(G.P.x / 16), Math.floor(G.P.y / 16), G.zoneAt(G.P.x, G.P.y)]; });
    assert.deepEqual(f, [641, 260, 'zCork']);
    await g.eval(() => window.__GP4.boat(1));
    await g.page.waitForTimeout(700);
    await g.step(80);
    assert.equal(await g.eval(() => window.__G.P.boat), 1);
    await g.page.keyboard.down('KeyD'); await g.step(60); await g.page.keyboard.up('KeyD');
    const b = await g.eval(() => { const G = window.__G, X = window.__GP4; return [G.P.boat, X.sea(Math.floor(G.P.x / 16), Math.floor(G.P.y / 16)), G.P.x > 641 * 16]; });
    assert.deepEqual(b, [1, true, true]);
    await g.eval(() => window.__G.P.ride = 0);
    await g.page.keyboard.press('KeyH'); await g.step(2);
    assert.ok(!(await g.eval(() => window.__G.P.ride)), 'no horse in a boat');
    // sail north into the harbor beach
    await g.eval(() => { const G = window.__G; G.P.x = 290 * 16 + 8; G.P.y = 249 * 16 + 8; });
    await g.page.keyboard.down('KeyW'); await g.step(90); await g.page.keyboard.up('KeyW');
    const l = await g.eval(() => { const G = window.__G, X = window.__GP4; return [G.P.boat, X.sea(Math.floor(G.P.x / 16), Math.floor(G.P.y / 16)), G.P.y < 248 * 16]; });
    assert.deepEqual(l, [0, false, true]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the Kraken: shielded while its six tentacles stand, surfaces when they are cut, dives and grows them back; its ink blinds', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await at(g, 696, 254);
    await g.step(10);
    const r = await g.eval(() => {
      const G = window.__G, X = window.__GP4, K = G.mons().find((m) => m.type === 'kraken'), T = () => G.mons().filter((m) => m.type === 'ktent' && !m.dead);
      const n0 = T().length, a0 = X.atk(K), boat = G.P.boat; for (const m of T()) window.__GU.killMon(m); return { n0, a0, boat };
    });
    assert.deepEqual(r, { n0: 6, a0: 0.1, boat: 1 });
    await g.step(4);
    assert.ok(await g.eval(() => window.__GP4.P4.kUp > 14));
    assert.equal(await g.eval(() => window.__GP4.atk(window.__G.mons().find((m) => m.type === 'kraken'))), 1);
    await g.eval(() => { window.__GP4.P4.kUp = 0.01; });
    await g.step(4);
    assert.equal(await g.eval(() => window.__G.mons().filter((m) => m.type === 'ktent' && !m.dead).length), 6);
    const k = await g.eval(() => { const G = window.__G, X = window.__GP4; X.phit({ sp: 'ink' }); const ink = X.P4.ink; const K = G.mons().find((m) => m.type === 'kraken'); const hx = K.hx; K.x += 50; X.tick(1 / 60); return [ink, K.x === hx]; });
    assert.deepEqual(k, [4, true], 'it stays where it is');
    await g.step(20);
    const w = await g.eval(() => { const G = window.__G; window.__GU.killMon(G.mons().find((m) => m.type === 'kraken')); return !!(window.__GU.WS.wb && window.__GU.WS.wb.kraken > Date.now()); });
    assert.ok(w);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the Bard: learned from the minstrel, three songs; a good rhythm gives the song to you and to your presence, a poor one fails', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GP4, C = window.__GC2, U = window.__GU; S.lv = 30; S.gold = 5000;
      const off = ['bvalor', 'bswift', 'brest'].filter((k) => C.cls().includes(k)).length, opt = U.secOpt('minst').length;
      U.secOpt('minst')[0].f(); const on = ['bvalor', 'bswift', 'brest'].filter((k) => C.cls().includes(k)).length;
      return { off, opt, on, sec: S.sec };
    });
    assert.deepEqual(r, { off: 0, opt: 1, on: 3, sec: 'bard' });
    await g.eval(() => { window.__G.advance && window.__G.advance(); });
    await g.step(30);
    await g.eval(() => { const G = window.__G; G.mons().forEach((m) => { m.dead = true; m.rt = 1e9; }); if (G.mode !== 'play') G.advance(); });
    await g.step(10);
    const s = await g.eval(() => {
      const X = window.__GP4; X.song('a'); const R = X.P4.rh, mode = window.__G.mode;
      R.n.forEach((n) => { R.t0 = performance.now() / 1000 - n; X.strum(); }); X.tick(1 / 60);
      return { mode, j: R.j.slice(), aura: X.P4.aura && X.P4.aura.k, song: X.P4.song && X.P4.song.k, st: X.st(), atk: X.atk({ type: 'wolf' }) };
    });
    assert.equal(s.mode, 'song');
    assert.deepEqual(s.j, [2, 2, 2, 2, 2, 2, 2, 2]);
    assert.deepEqual([s.aura, s.song, s.st], ['a', 'a', 'a']);
    assert.ok(Math.abs(s.atk - 1.1) < 1e-9);
    await g.page.waitForTimeout(700); await g.step(2);
    const f = await g.eval(() => { const X = window.__GP4; X.song('c'); X.P4.rh.t0 -= 60; X.tick(1 / 60); return [X.P4.rh.j.filter(Boolean).length, X.P4.aura.k]; });
    assert.deepEqual(f, [0, 'a'], 'no notes, no new song');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the stage: a pad sings under your feet; the dance takes ten arrows and pays once in a while', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await at(g, 378, 78);
    await g.step(4);
    assert.equal(await g.eval(() => window.__GP4.P4.padOn[0]), true);
    await g.eval(() => { const G = window.__G; G.S.gold = 0; G.mons().forEach((m) => { m.dead = true; m.rt = 1e9; }); window.__GP4.act({ k: 'p4stage' }); });
    assert.equal(await g.eval(() => window.__G.mode), 'dance');
    assert.ok(await g.eval(() => window.__GP4.P4.dance.wait) > 0, 'it waits for the next beat (v3.24)');
    await g.eval(() => { window.__GP4.P4.dance.wait = 0; });
    const KEY = { L: 'ArrowLeft', U: 'ArrowUp', R: 'ArrowRight', D: 'ArrowDown' };
    for (let i = 0; i < 10; i++) {
      // the pause between arrows runs out by itself (owner 2026-10-22: the dance froze the game, so the arrows never took)
      await g.eval(() => { window.__GP4.P4.dance.t = 9; });
      await g.step(45);
      const d = await g.eval(() => window.__GP4.P4.dance.seq[window.__GP4.P4.dance.i]);
      await g.page.keyboard.press(KEY[d]);
    }
    const r = await g.eval(() => [window.__GP4.P4.dance.ok, window.__G.S.gold]);
    assert.deepEqual(r, [10, 800]);
    await g.page.waitForTimeout(900); await g.step(2);
    assert.equal(await g.eval(() => window.__G.mode), 'play');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
