'use strict';
// v3.10 Auto production (the player Suki through the owner 2026-10-26: "Add the Auto Production Button for Blacksmith, and for
// Production Classes just like the webnovel ... maybe make it get lower quality or lower rarity stuff so doing stuff yourself
// is still more valuable"). ch 925: its time follows the blacksmithing level and dexterity; Pagma's Successor cannot.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the anvil: one switch, then the recipes make themselves while you stand still, Normal or Rare only', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    // the switch in the forge's service row, and the recipe button it turns automatic
    const ui = await g.eval(() => {
      const G = window.__G, S = G.S, A = window.__GAUTO; S.rcK = S.rcK || {}; S.rcK.isword = 1; Object.assign(S.mats, { ore: 15, wood: 3 }); S.qs.kh3 = S.qs.kh3 || { st: 2, c: 1 };
      G.eqx.openForge(); const sw = document.querySelector('#rlist [data-act="fAuto"]'), o = { sw: sw && sw.textContent };
      sw.click(); o.on = A.on();
      const row = [...document.querySelectorAll('#rlist .recipe')].find((r) => /Iron Sword/.test(r.textContent)), b = row && row.querySelector('button');
      o.btn = b && b.textContent; b.click(); o.mode = G.mode; o.A = !!A.A; o.dur = A.dur('smith');
      return o;
    });
    assert.deepEqual([ui.sw, ui.on, ui.btn, ui.mode, ui.A], ['⚙ Auto production: off', true, '⚙ Auto', 'play', true]);
    assert.ok(ui.dur > 8.5 && ui.dur <= 9, 'about nine seconds at smithing level 1 with a beginner\'s dexterity: ' + ui.dur);
    // three swords from the materials of three, then it stops by itself
    const r = await g.eval(() => { const G = window.__G, S = G.S, A = window.__GAUTO, n0 = S.items.filter((i) => i.id === 'isword').length; for (let i = 0; i < 400 && A.A; i++) A.tick(.1);
      const made = S.items.filter((i) => i.id === 'isword').slice(n0); return { n: made.length, rs: made.map((i) => i.r), ore: S.mats.ore, A: !!A.A }; });
    assert.equal(r.n, 3); assert.ok(r.rs.every((x) => x <= 1), 'Normal or Rare'); assert.equal(r.ore, 0); assert.equal(r.A, false);
    // a master's: faster, and still never Epic or better
    const m = await g.eval(() => { const G = window.__G, S = G.S, A = window.__GAUTO; S.cls = 'smith'; S.smith = 20; S.st.dex = (S.st.dex || 0) + 2500; const d = A.dur('smith'); S.mats.ore = 300; S.mats.wood = 60; const n0 = S.items.length;
      A.start('smith', { rc: A.rc('isword') }); for (let i = 0; i < 4000 && A.A; i++) A.tick(.1); const L = S.items.slice(n0); return { d, n: L.length, max: Math.max(...L.map((i) => i.r)) }; });
    assert.ok(m.d < 4, 'level and dexterity shorten it: ' + m.d); assert.equal(m.n, 60); assert.ok(m.max <= 1, 'never Epic: ' + m.max);
    // moving stops it, nothing lost
    const mv = await g.eval(() => { const G = window.__G, S = G.S, A = window.__GAUTO; S.mats.ore = 5; S.mats.wood = 1; A.start('smith', { rc: A.rc('isword') }); A.tick(.5); G.P.x += 20; A.tick(.1); return { A: !!A.A, ore: S.mats.ore }; });
    assert.deepEqual(mv, { A: false, ore: 5 });
    // (review) a blow stops it; shiny materials are kept for your hands; nothing counted as made by hand
    const rv = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, A = window.__GAUTO, o = {};
      S.mats.ore = 5; S.mats.wood = 1; A.start('smith', { rc: A.rc('isword') }); A.tick(.5); P.hitT = (P.hitT || 0) + 999; A.tick(.1); o.hit = !!A.A;
      S.mats.ore = 5; S.mats.shnore = 5; S.mats.wood = 3; const m0 = (S.made || {}).isword || 0, n0 = S.items.length; A.start('smith', { rc: A.rc('isword') }); for (let i = 0; i < 400 && A.A; i++) A.tick(.1);
      o.made = S.items.length - n0; o.shn = S.mats.shnore; o.count = ((S.made || {}).isword || 0) - m0; return o; });
    assert.deepEqual(rv, { hit: false, made: 1, shn: 5, count: 0 });
    // Pagma's Successor cannot (ch 925)
    const pg = await g.eval(() => { const G = window.__G, S = G.S, A = window.__GAUTO; S.cls = 'pagma'; const ok = A.start('smith', { rc: A.rc('isword') }); G.eqx.openForge(); const sw = document.querySelector('#rlist [data-act="fAuto"]'); const row = [...document.querySelectorAll('#rlist .recipe')].find((x) => /Iron Sword/.test(x.textContent)); return { ok, sw: sw.textContent, btn: row.querySelector('button').textContent }; });
    assert.deepEqual(pg, { ok: false, sw: '⚙ Auto production', btn: 'Forge' });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the fire and the tailor: dishes never perfect, garments Normal or Rare, half the experience', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, A = window.__GAUTO, RB = window.__GRB, o = {}; S.autoP = 1;
      // the camp's menu has the switch first; a dish from it goes on its own
      S.mats.fish = 3; const c0 = S.mats.cfish || 0, x0 = (S.life || {}).cook || 0;
      RB.make('cfish', false); o.cook = !!A.A; for (let i = 0; i < 400 && A.A; i++) A.tick(.1);
      o.cfish = (S.mats.cfish || 0) - c0; o.fish = S.mats.fish; o.cx = ((S.life || {}).cook || 0) - x0;
      // a garment
      const rc = window.__GU.TRC[0]; for (const [m, n] of Object.entries(rc.need)) S.mats[m] = (S.mats[m] || 0) + n * 2; const n0 = S.items.length;
      A.start('sew', { rc }); for (let i = 0; i < 400 && A.A; i++) A.tick(.1); const L = S.items.slice(n0); o.sew = [L.length, Math.max(...L.map((i) => i.r))];
      o.opt = A.opt('cook')[0].l;
      RB.camp(); const DO = G.DL && G.DL.opts || []; o.last = DO.length >= 2 && /Auto production/.test(DO[DO.length - 2].l); G.DL = null;
      return o;
    });
    assert.equal(r.cook, true); assert.equal(r.cfish, 3, 'one dish for each, never the perfect extra'); assert.equal(r.fish, 0);
    assert.ok(r.cx > 0);
    assert.equal(r.sew[0], 2); assert.ok(r.sew[1] <= 1);
    assert.equal(r.opt, '⚙ Auto production: on');
    assert.equal(r.last, true, 'the switch just before Leave: the cursor starts on a dish');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
