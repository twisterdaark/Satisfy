'use strict';
// Fighting yourself (owner 2026-10-23: "yourself uses exactly the same skills, the same look, the same everything, because
// those aren't my skills"): the clone in the Behen tower casts only the skills on your own bar, through your own skill
// code, and its blows land on you while your own cooldowns, health and buffs stay as they were.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

for (const cls of ['warrior', 'bmage']) test('the clone of a ' + cls + ' fights with that ' + cls + "'s own bar", async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r0 = await g.eval((cls) => { const G = window.__G, S = G.S, P = G.P; S.cls = cls; S.lv = 80; S.bar = null; for (const m of G.mons()) m.dead = true;
      P.hp = 1e7; P.cd = {}; window.__cd0 = JSON.stringify(P.cd);
      const m = G.spawnMon('bhclone', P.x + 36, P.y); m.mir = 1; m.lv = S.lv; m.hp = m.max = 1e9; m.dmul = 1; window.__mc = m;
      return { bar: window.__GMIR.skills() }; }, cls);
    assert.ok(r0.bar.length >= 2, 'the ' + cls + ' has skills on the bar: ' + r0.bar);
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      await g.step(30);
      const k = await g.eval(() => { const G = window.__G; G.P.hp = Math.max(G.P.hp, 1e6); G.P.inv = 0; return Object.keys(window.__mc.mcd || {}); });
      for (const x of k) seen.add(x);
    }
    const r = await g.eval(() => ({ learnt: (window.__mc.msk || []).map((s) => s.k), cd: JSON.stringify(window.__G.P.cd), hp: window.__G.P.hp }));
    assert.ok(r.learnt.length >= 1, 'it learnt your skills: ' + r.learnt);
    for (const k of r.learnt) assert.ok(r0.bar.includes(k), k + ' is on your bar');
    assert.ok(seen.size >= 1, 'it cast at least one of them');
    for (const k of seen) assert.ok(r0.bar.includes(k), 'it cast only your skills: ' + k);
    assert.equal(r.cd, '{}', 'your own cooldowns stay untouched');
    assert.ok(r.hp < 1e7, 'its blows land on you');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
