'use strict';
// Braham's Successor with the novel's Braham spells (owner decision 2026-10-22, legends/legend-audit.md §2): Shield, Fire,
// Teleport, Weapon Enchant, Detect Force, Wind Cutter, Lightning, Grease, Mana Drain, Giga Lightning, Magic Contemplation
// and Assimilation beside Magic Missile, Chain Lightning, Meteor and Frozen Tempest (no Absolute Zero, which is Bondre's).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());
const LOOK = { n: 'Braham', hair: 1, hc: 2, skin: 1, top: 3 };

test("Braham's spells are learned by level and each does what the novel says", async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, Z = window.__GBZ, A = window.__GSKF;
      S.cls = 'braham'; S.lv = 200; P.hp = G.maxHP(); G.isk.checkSkills();
      const learned = Object.keys(Z.BZK).filter((k) => S.sk[k]);
      for (const m of G.mons()) m.dead = true;
      const m = G.spawnMon('forc', P.x + 30, P.y); m.max = m.hp = 1e9; m.tmp = 0; m.lv = 1;
      const out = { learned };
      P.mp = 1e6; A.cast('bshield'); const h0 = P.hp; out.absorbed = window.__GPG.hurt(40, m) === 0 && P.hp === h0;
      P.mp = 1e6; A.cast('blight'); out.light = 1e9 - m.hp > 0;
      const d0 = window.__GPG.dm(); P.mp = 1e6; A.cast('benc'); out.enc = window.__GPG.dm() / d0;
      P.mp = 1e6; A.cast('bgrease'); const gr = Z.grease(); m.x = gr.x; m.y = gr.y; Z.tick(.016); out.slow = m.slowU > window.__GPG.gt();
      P.mp = 0; A.cast('bdrain'); out.drain = P.mp > 0;
      out.names = [G.t ? 1 : 1];
      return out; });
    assert.deepEqual(r.learned.sort(), ['bassim', 'bcont', 'bdetect', 'bdrain', 'benc', 'bfire', 'bgiga', 'bgrease', 'bshield', 'btele', 'blight', 'bwind'].sort());
    assert.equal(r.absorbed, true); assert.equal(r.light, true); assert.ok(Math.abs(r.enc - 1.5) < 1e-6); assert.equal(r.slow, true); assert.equal(r.drain, true);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
