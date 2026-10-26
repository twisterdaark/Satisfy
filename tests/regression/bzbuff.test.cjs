'use strict';
// Braham made stronger (the player Soki through the owner 2026-10-26: "buff/add skills to most legendary classes"): his spells
// hit about 30% harder, Chain Lightning leaps to 8, and at level 300 Braham's Enhanced Magic (ch1134) makes his spells free
// with half the cooldown for 15 s, not Assimilation or Mass Teleport.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test("Braham: Chain Lightning to eight, Enhanced Magic at 300 makes his spells free with half the cooldown", async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Braham', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, Z = window.__GBZ, C = window.__GSS2.cast, A = window.__GSKF;
      S.cls = 'braham'; S.lv = 299; G.isk.checkSkills(); const out = { at299: !!S.sk.bemag };
      S.lv = 300; G.isk.checkSkills(); out.at300 = !!S.sk.bemag;
      const st = G.isk.mkItem('staff', 1); S.items.push(st); S.eqW = st.uid; P.dir = 2;
      for (const m of G.mons()) m.dead = true;
      const ws = []; for (let i = 0; i < 9; i++) { const m = G.spawnMon('wolf', P.x + 30 + i * 40, P.y); m.max = m.hp = 1e9; m.tmp = 0; m.lv = 1; ws.push(m); }
      P.mp = 1e6; A.cast('bchain'); out.chain = ws.filter((m) => m.hp < 1e9).length;
      P.cd = {}; P.mp = 1e6; C('bfire'); out.cdBefore = P.cd.bfire;
      P.cd = {}; P.mp = 1e6; C('bemag'); out.on = Z.emOn('bfire'); out.notAssim = Z.emOn('bassim') || Z.emOn('bmasst') || Z.emOn('bemag');
      P.cd = {}; P.mp = 50; C('bfire'); out.mpAfter = P.mp; out.cdAfter = P.cd.bfire;
      return out; });
    assert.equal(r.at299, false); assert.equal(r.at300, true);
    assert.equal(r.chain, 8, 'Chain Lightning leaps to eight');
    assert.equal(r.on, true); assert.equal(r.notAssim, false);
    assert.equal(r.mpAfter, 50, 'a spell costs no mana under Enhanced Magic');
    assert.ok(Math.abs(r.cdAfter - r.cdBefore / 2) < 1e-6, `half the cooldown (${r.cdBefore} -> ${r.cdAfter})`);
    await g.step(60 * 16);
    assert.equal(await g.eval(() => window.__GBZ.emOn('bfire')), false, 'over after 15 s');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
