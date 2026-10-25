'use strict';
// v3.07 a weapon's Endurance (the player Suki through the owner 2026-10-25: "Each weapon now has a new stat attached to it
// called: Endurance. The more you repair a weapon the higher endurance it gains. Endurance reduces the rate at which a weapon
// breaks down… "strengthen" use gemstones… Endurance may also prevent your weapon from breaking if at high levels and restore
// 25% of it's durability."):
//   - a repair gives a weapon a point for every 25 durability it gets back; armour gets none;
//   - Strengthen at a smith or the anvil: a gem and gold for 10 points, a diamond or a thunderstone for 20, up to level 10;
//   - each level wears 5% slower; from level 7 a weapon about to break may hold and come back to 25;
//   - the tooltip shows it.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('Endurance: repairs and Strengthen raise it; it slows wear and can save a weapon from breaking', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, E = window.__GEDR, S = G.S, o = {};
      const w = G.eqx.mkItem('isword', 1), a = G.eqx.mkItem('larmor', 1); S.items.push(w, a); o.lv0 = E.lv(w);
      // a smith's repair: 50 back is 2 points; armour none
      w.dur = 50; a.dur = 50; S.gold = 100000; G.eqx.repairAll('khan'); o.rep = [w.dur, E.pts(w), a.edr || 0];
      // (review) small repairs add up by what they give back: 20 repairs of 1 are less than a point
      const v = G.eqx.mkItem('isword', 1); S.items.push(v); for (let k = 0; k < 20; k++) { v.dur = 99; G.eqx.repairAll('khan'); } o.small = [v.edr, E.pts(v)];
      // the thresholds
      o.T = E.T.slice(); w.edr = 4 * E.U; o.l4 = E.lv(w); w.edr = 5 * E.U; o.l5 = E.lv(w); w.edr = 380 * E.U; o.l10 = E.lv(w); w.edr = 999 * E.U; o.lmax = E.lv(w);
      // Strengthen: a ruby 10, a diamond 20
      w.edr = 0; S.mats.ruby = 1; S.mats.diam = 1; const g0 = S.gold; E.do(w, 'ruby', 'khan'); o.ruby = [E.pts(w), S.mats.ruby, g0 - S.gold]; E.do(w, 'diam', 'khan'); o.diam = [E.pts(w), S.mats.diam];
      // (review) armour can't be strengthened, even if it comes first
      S.mats.ruby = 1; E.do(a, 'ruby', 'khan'); o.armour = [a.edr || 0, S.mats.ruby];
      o.svc = E.svc('khan').some((l) => /Strengthen/.test(l));
      // wear: level 10 wears about half as often
      const cnt = (lv) => { const x = G.eqx.mkItem('isword', 0); x.edr = E.T[lv] * E.U; let n = 0; for (let k = 0; k < 4000; k++) { x.dur = 100; E.wear(x, .5); if (x.dur < 100) n++; } return n; };
      o.w0 = cnt(0); o.w10 = cnt(10);
      // about to break at level 10: held about 60% of the time, back at 25
      const x = G.eqx.mkItem('isword', 0); x.edr = E.T[10] * E.U; let held = 0, broke = 0; for (let k = 0; k < 400; k++) { x.dur = 1; E.wear(x, 100); if (x.dur === 25) held++; else if (x.dur === 0) broke++; }
      o.save = [held, broke];
      const y = G.eqx.mkItem('isword', 0); y.edr = E.T[6] * E.U; let h6 = 0; for (let k = 0; k < 200; k++) { y.dur = 1; E.wear(y, 100); if (y.dur === 25) h6++; } o.h6 = h6;
      o.tip = E.tip(w);
      return o;
    });
    assert.equal(r.lv0, 0);
    assert.deepEqual(r.rep, [100, 2, 0], 'a repair of 50: two points; armour none');
    assert.deepEqual(r.small, [20, 0], 'twenty repairs of 1: 20 toward a point, not 20 points');
    assert.deepEqual(r.armour, [0, 1], 'no Strengthen for armour');
    assert.deepEqual([r.l4, r.l5, r.l10, r.lmax], [0, 1, 10, 10]);
    assert.equal(r.ruby[0], 10); assert.equal(r.ruby[1], 0); assert.ok(r.ruby[2] > 0 && r.ruby[2] <= 1000, 'gold: ' + r.ruby[2]);
    assert.deepEqual(r.diam, [30, 0], 'a diamond: 20');
    assert.equal(r.svc, true, 'Strengthen at the smith');
    assert.ok(r.w10 < r.w0 * 0.62 && r.w10 > r.w0 * 0.38, 'level 10 wears about half: ' + [r.w0, r.w10]);
    assert.ok(r.save[0] > 180 && r.save[0] < 300 && r.save[0] + r.save[1] === 400, 'level 10 holds ~60%: ' + r.save);
    assert.equal(r.h6, 0, 'level 6 never holds');
    assert.match(r.tip, /Endurance Lv 3 <em>\(30\/50\)<\/em> · wears 15% slower/);
    // the anvil has a Strengthen button
    assert.ok(await g.eval(() => { window.__G.eqx.openForge(); return /Strengthen/.test(document.getElementById('rlist').textContent); }));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
