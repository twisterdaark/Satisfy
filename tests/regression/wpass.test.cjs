'use strict';
// Weapon passives (owner 2026-10-22): an epic weapon rolls one random passive, unique two, legendary three, and a hidden
// function found by appraisal can add one more. They show in the tooltip and work while the weapon is held.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('epic and better weapons roll passives, appraisal can add a hidden one', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const X = window.__G.isk, A = window.__GAP;
      const n = [0, 1, 2, 3, 4].map((q) => (X.mkItem('isword', q).wp || []).length);
      const it = X.mkItem('isword', 4), tip = X.itemTip(it);
      let hid = 0; window.__G.S.cls = 'pagma'; for (let i = 0; i < 60; i++) { const w = X.mkItem('isword', 1); window.__G.S.gold = 1e9; A.doApr(w, 'anvil'); if ((w.wp || []).some((p) => p.h)) hid++; }
      return { n, kinds: new Set(it.wp.map((p) => p.k)).size, tip, hid }; });
    assert.deepEqual(r.n, [0, 0, 1, 2, 3]);
    assert.equal(r.kinds, 3, 'no passive twice on one weapon');
    assert.equal((r.tip.match(/◆/g) || []).length, 3);
    assert.ok(r.hid > 0, 'a hidden function turned into a passive at least once in 60 appraisals');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// owner 2026-10-22: something to keep an enhancement from dropping. A Protection Stone keeps the level on a failure,
// a Blessing Stone adds 10% to the odds; each is used up by the try.
test('a Protection Stone keeps the enhancement level when a try fails', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(async () => { const G = window.__G, S = G.S, X = G.eqx;
      S.gold = 1e12; S.mats.mstone = 999; S.mats.estone = 999; S.mats.pstone = 8;
      const w = S.items.find((i) => i.slot === 'w'); w.en = 9; const lv = [];
      for (let i = 0; i < 8; i++) { X.enhance(w, 'smith', { pr: 1 }); lv.push(w.en); }
      return { lv, left: S.mats.pstone }; });
    assert.equal(r.left, 0, 'each try uses one stone');
    assert.ok(r.lv.every((n) => n >= 9), 'never below +9: ' + r.lv.join(','));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// owner 2026-10-22 (more passives): a second strike, lightning that jumps to two more, damage taken paid back in the
// next hit, frost that slows, a throw back; a Thunder Stone set in the weapon shocks too
test('double strike, shock, absorb, frost and push work in a fight; the Thunder Stone shocks', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.eval(() => { const G = window.__G, S = G.S; S.lv = 200; G.P.hp = 1e9; });
    const spawn = (n) => g.eval((n) => { const G = window.__G; for (const m of window.__ms || []) m.dead = true; window.__ms = []; for (let i = 0; i < n; i++) { const m = G.spawnMon('wolf', G.P.x + 30 + i * 20, G.P.y); m.hp = m.max = 1e9; m.tmp = 0; window.__ms.push(m); } }, n);
    const setWp = (wp, gem) => g.eval(([wp, gem]) => { const S = window.__G.S, w = S.items.find((i) => i.uid === S.eqW) || S.items.find((i) => i.slot === 'w'); w.wp = wp; if (gem) w.gem = gem; else delete w.gem; }, [wp, gem]);
    // extra strikes: a weapon with three of them lands four hits in all
    await spawn(1); await setWp([{ k: 'dbl', v: 1, n: 3 }]);
    await g.eval(() => { const m = window.__ms[0]; window.__hs = []; const h0 = m.hp; window.__GWP.hit(m); window.__hs.push(h0 - m.hp); window.__hp = m.hp; });
    await g.page.waitForTimeout(800); await g.step(2);
    const dbl = await g.eval(() => [window.__hs[0], window.__hp - window.__ms[0].hp]);
    assert.ok(dbl[0] > 0 && dbl[1] >= dbl[0] * 2, 'first hit then three more: ' + dbl);
    // shock does nothing on a weapon with nothing to do with lightning
    await spawn(3); await setWp([{ k: 'shock', v: 1 }]);
    assert.equal(await g.eval(() => window.__GWP.V('shock')), 0);
    // with a Thunder Stone set in it: the stone's 15% and the passive, and the two beside the target are hit too
    await setWp([{ k: 'shock', v: 1 }], 'thund');
    assert.equal(await g.eval(() => window.__GWP.V('shock')), 1.15);
    const sh = await g.eval(() => { const M = window.__ms, h = M.map((m) => m.hp); window.__GWP.hit(M[0]); return M.map((m, i) => h[i] - m.hp); });
    assert.ok(sh.every((d) => d > 0), 'all three took damage: ' + sh);
    // rolls: no shock on an iron sword; the Blue Dragon spear can; extra strikes by grade and materials
    const rl = await g.eval(() => { const X = window.__G.isk; let ironShock = 0, spearShock = 0, ironN = 0, spearN = 0; const js = new Set(), st = new Set();
      for (let i = 0; i < 300; i++) { const a = X.mkItem('isword', 4), b = X.mkItem('dgspear', 4);
        for (const p of a.wp) { if (p.k === 'shock') ironShock++; if (p.k === 'dbl') ironN = Math.max(ironN, p.n); }
        for (const p of b.wp) { if (p.k === 'shock') { spearShock++; js.add(p.j); st.add(p.st); } if (p.k === 'dbl') spearN = Math.max(spearN, p.n); } }
      return { ironShock, spearShock, ironN, spearN, js: [...js].sort(), st: [...st].length, stMin: Math.min(...st), stMax: Math.max(...st) }; });
    assert.equal(rl.ironShock, 0); assert.ok(rl.spearShock > 0, 'the Blue Dragon spear rolls shock');
    assert.deepEqual(rl.js, [1, 2, 3], 'a legendary shock jumps to 1, 2 or 3'); assert.ok(rl.st > 5 && rl.stMin >= .2 && rl.stMax <= .5, 'stun between 0.2 and 0.5 s, not fixed');
    assert.equal(rl.ironN, 3, 'a legendary iron sword: up to 3 extra strikes'); assert.equal(rl.spearN, 4, 'a legendary breath weapon: up to 4');
    // absorb: half of 1000 taken comes back in the next hit
    await spawn(1); await setWp([{ k: 'abs', v: 0.5 }]);
    const ab = await g.eval(() => { const G = window.__G; G.P.inv = 0; G.P.dash = 0; window.__GWP.hurt(1000); const b = window.__GWP.absB; window.__GWP.hit(window.__ms[0]); return [b, window.__GWP.absB]; });
    assert.ok(ab[0] > 0 && ab[1] === 0, 'stored then paid back: ' + ab);
    // frost slows; push throws back
    await spawn(1); await setWp([{ k: 'frost', v: 1 }, { k: 'push', v: 1 }]);
    const fp = await g.eval(() => { const m = window.__ms[0], x0 = m.x; window.__GWP.hit(m); return { slow: m.slowU > 0, moved: Math.abs(m.x - x0) }; });
    assert.ok(fp.slow, 'slowed'); assert.ok(fp.moved > 4, 'pushed ' + fp.moved);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
