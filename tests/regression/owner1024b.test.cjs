'use strict';
// The owner's 2026-10-24 morning list, second part: the tournament against copies of the highest levels (players' battle
// cards), the East's magic circle only once you have been there and Sticks's free scroll for Behen's purifier, and towns at
// war (the fighters walk out and fight with their skills, the townsfolk and children hide in the houses).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('tournament copies, Sticks and the circle, towns at war', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    // a battle card: what a copy needs, read back the same; the bracket takes the four highest, weakest first
    const c = await g.eval(() => { const M = window.__GMIR, G = window.__G, S = G.S; S.lv = 480; const raw = M.card('Suki'), c = M.cardOf(raw);
      const L = M.list([Object.assign({}, c, { n: 'Suki', lv: 480 }), Object.assign({}, c, { n: 'Low', lv: 100 })]);
      return { len: raw.length, lv: c.lv, n: c.n, sk: Array.isArray(c.sk), list: L.map((e) => [e.n, e.lv, !!e.card]) }; });
    assert.ok(c.len <= 1500, 'fits the rules: ' + c.len);
    assert.deepEqual([c.lv, c.n, c.sk], [480, 'Suki', true]);
    assert.equal(c.list.length, 4);
    assert.deepEqual(c.list[3], ['Suki', 480, true], 'the strongest comes last');
    assert.ok(!c.list.some((e) => e[0] === 'Low'), 'only the four highest');
    // the copy: their name, level, look and skills, fought with the clone's engine
    const f = await g.eval(() => { const M = window.__GMIR, G = window.__G, c = M.cardOf(M.card('Suki')); M.go([{ card: c, lv: 480, n: 'Suki' }]); return true; });
    assert.ok(f);
    await g.step(260);
    const m = await g.eval(() => { const x = window.__G.mons().find((m) => m.arena && m.card); return x ? { nm: x.nm, lv: x.lv, mir: x.mir, hp: x.hp > 0 } : null; });
    assert.deepEqual(m, { nm: 'Suki', lv: 480, mir: 1, hp: true });

    // the circle only after a visit; Sticks gives the purifier one scroll, once
    const ea = await g.eval(() => { const G = window.__G, S = G.S, E = window.__GEA, b = window.__GBH.s(); b.pur = 1; S.mats.ecscr = 0;
      window.__GBH.ask(); const o = G.DL.opts.find((x) => /East Continent|القارة الشرقية/.test(x.l)); o.f(); const n1 = S.mats.ecscr; window.__GBH.ask(); const again = G.DL.opts.some((x) => /East Continent|القارة الشرقية/.test(x.l));
      return { n1, again }; });
    assert.deepEqual(ea, { n1: 1, again: false });

    // a town at war: a guard walks out to an invader, the townsfolk run for the houses and hide
    await g.eval(() => window.__GU.forceEvent('invW', 300000));
    await g.step(30);
    const w0 = await g.eval(() => { const G = window.__G, E = window.__GN.EV, T = 'zWin', tf = window.__GFX.tf().filter((f) => f.T === T);
      const gd = G.npcs.find((n) => /^guard/.test(n.id) && !n.hidden); const m = E.mons.find((x) => !x.dead);
      if (gd && m) { m.x = gd.x + 120; m.y = gd.y; m.goal = { x: m.x, y: m.y }; }
      return { gd: gd && { id: gd.id, x: gd.x, y: gd.y }, tf: tf.length }; });
    assert.ok(w0.gd, 'a guard in Winston');
    for (let i = 0; i < 6; i++) { await g.eval(() => { window.__GNW.fight(1 / 60); window.__GFX.tick(1 / 60); }); await g.step(10); }
    const w1 = await g.eval((id) => { const G = window.__G, n = G.npcs.find((n) => n.id === id), tf = window.__GFX.tf().filter((f) => f.T === 'zWin' && f.role !== 'spar');
      return { moved: n.hx != null, hide: tf.filter((f) => f.hid || f.door).length, all: tf.length }; }, w0.gd.id);
    assert.ok(w1.moved, 'the guard left its post');
    assert.ok(w1.hide > 0 && w1.hide === w1.all, JSON.stringify(w1));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
