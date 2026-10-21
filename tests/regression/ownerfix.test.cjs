'use strict';
// Owner fixes (v1.05, Twister 2026-10-21): a monster shot from beyond its aggro range comes for the shooter; monsters
// turn round instead of walking backwards; townsfolk walk to their spot instead of jumping; on a phone the dialog's
// options are tapped directly (the fight buttons and the stick step aside while it is open).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());
const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };

test('shot from afar, a monster comes for you; moving away it turns its back; townsfolk walk', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.step(3);
    const d0 = await g.eval(() => { const G = window.__G, P = G.P; P.x = 90 * 16; P.y = 60 * 16; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } G.S.lv = 40;
      const m = G.spawnMon('wolf', P.x + 300, P.y); m.max = m.hp = 1e9; m.lv = 40; window.__m = m; window.__GC2.hit(m); return Math.hypot(m.x - P.x, m.y - P.y); });
    await g.step(150);
    const r = await g.eval(() => { const m = window.__m, P = window.__G.P; return { d: Math.hypot(m.x - P.x, m.y - P.y), eng: m.eng > 0, ret: !!m.ret }; });
    assert.ok(r.eng && !r.ret && r.d < d0 - 80, JSON.stringify([d0, r]));
    // a monster that steps away faster than a shuffle faces the way it goes; a small shuffle back keeps it facing you
    const t = await g.eval(() => { const T = window.__GFX.turn, b = { spd: 40 }, dt = 1 / 60, a = { x: 100, face: 1, st: null }, c = { x: 100, face: 1, st: null }, e = { x: 100, face: 1, st: 'tele' };
      T(a, b, 101, dt); T(c, b, 100.1, dt); T(e, b, 101, dt); return [a.face, c.face, e.face]; });
    assert.deepEqual(t, [-1, 1, 1]);
    // a townsperson pushed off its spot walks back at walking pace, it does not jump there
    const w = await g.eval(() => { const G = window.__G, F = window.__GFX, L = F.tf(); if (!L || !L.length) F.tick(1 / 60); const f = F.tf().find((x) => x.role === 'walk'); G.P.x = f.x; G.P.y = f.y; F.tick(1 / 60);
      const x0 = f.x + 200; f.x = x0; F.tick(1 / 60); const s1 = Math.abs(f.x - x0); for (let i = 0; i < 59; i++) F.tick(1 / 60); return [s1, Math.abs(f.x - x0)]; });
    assert.ok(w[0] > 0 && w[0] < 2, 'one frame: ' + w[0]);
    assert.ok(w[1] > 30 && w[1] < 70, 'one second: ' + w[1]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a phone: the dialog options are tapped directly, the fight buttons step aside, Use still works', async () => {
  const ctx = await H.newContext({ device: { viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, isMobile: true, hasTouch: true } });
  const g = await H.openGame({ ctx });
  try {
    await H.newGame(g, LOOK);
    await g.step(3);
    await g.eval(() => { const G = window.__G; G.DL = null; G.talkNPC('merchant'); });
    await g.step(2);
    await g.eval(() => { const G = window.__G; for (let i = 0; i < 6 && G.DL && !G.DL.optOn; i++) G.advance(); });
    await g.step(1);
    const v = await g.eval(() => { const vis = (s) => getComputedStyle(document.querySelector(s)).visibility; const dr = document.getElementById('dialog').getBoundingClientRect(), u = document.querySelector('#tAct [data-tk="KeyE"]').getBoundingClientRect();
      return [vis('#tAct [data-tk="atk"]'), vis('#tStick'), vis('#tAct [data-tk="KeyE"]'), dr.right <= u.left + 1]; });
    assert.deepEqual(v, ['hidden', 'hidden', 'visible', true]);
    // tap the last option (Leave) where it sits, on its right-hand end where the buttons used to cover it
    const b = await g.eval(() => { const o = [...document.querySelectorAll('#dopts [data-opt]')].pop(), r = o.getBoundingClientRect(); return [r.right - 12, r.top + r.height / 2]; });
    await g.page.touchscreen.tap(b[0], b[1]);
    await g.step(3);
    assert.equal(await g.mode(), 'play');
    assert.equal(await g.eval(() => getComputedStyle(document.querySelector('#tAct [data-tk="atk"]')).visibility), 'visible');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); await ctx.close(); }
});
