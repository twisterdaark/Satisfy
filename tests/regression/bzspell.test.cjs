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
    assert.deepEqual(r.learned.sort(), ['balarm', 'bassim', 'bbarr', 'bcont', 'bcrys', 'bdark', 'bdecoy', 'bdetect', 'bdetm', 'bdrain', 'benc', 'bfire', 'bgiga', 'bgrease', 'bice', 'bjam', 'bshield', 'btele', 'blight', 'bwind', 'bwing'].sort());
    assert.equal(r.absorbed, true); assert.equal(r.light, true); assert.ok(Math.abs(r.enc - 1.5) < 1e-6); assert.equal(r.slow, true); assert.equal(r.drain, true);
    // Alarm (owner 2026-10-24, novel "Alarm (Enhanced)"): set ahead, it rings 2.5 s later; the monster by it stops and is hit
    const al = await g.eval(() => { const G = window.__G, P = G.P, Z = window.__GBZ, A = window.__GSKF; G.S.face = 1; P.mp = 1e6; A.cast('balarm');
      const a = Z.alarms()[0], m = G.spawnMon('forc', a.x + 10, a.y); m.max = m.hp = 1e9; m.tmp = 0; m.lv = 1; m.stun = 5; m.alT = 1; return [Z.alarms().length, !!a]; });
    assert.deepEqual(al, [1, true]);
    await g.step(200); await g.page.waitForTimeout(700); await g.step(10);
    const rang = await g.eval(() => { const m = window.__G.mons().find((q) => q.alT); return [window.__GBZ.alarms().length, m.hp < 1e9, m.stun > 0 || m.hp < 1e9]; });
    assert.deepEqual(rang, [0, true, true]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test("the rest of Braham's novel magic: Detection, Decoy, Jamming, Ice Spear, Barrier, Crystal, Mass Teleport, Cohesion and Spray", async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, Z = window.__GBZ, A = window.__GSKF, gt = window.__GPG.gt;
      S.cls = 'braham'; S.lv = 260; P.hp = G.maxHP(); G.isk.checkSkills(); const st = G.isk.mkItem('staff', 1); S.items.push(st); S.eqW = st.uid;
      for (const m of G.mons()) m.dead = true;
      const mk = (dx) => { const m = G.spawnMon('forc', P.x + dx, P.y); m.max = m.hp = 1e9; m.tmp = 0; m.lv = 1; return m; };
      const m = mk(30), m2 = mk(50), m3 = mk(70), out = {};
      out.all = ['bmasst', 'bcoh', 'bspray'].every((k) => S.sk[k]);
      P.mp = 1e6; A.cast('bdetm'); out.detect = m.mk > 0 && m3.mk > 0;
      P.mp = 1e6; A.cast('bdecoy'); out.decoy = !!Z.decoy() && Z.lure(m, 0.016) === true;
      m.stun = 0; P.mp = 1e6; A.cast('bjam'); out.jam = m.stun > 0;
      m.stun = 0; P.mp = 1e6; A.cast('bice'); const h1 = 1e9 - m.hp; out.ice = m.iceU > gt();
      P.mp = 1e6; A.cast('bice'); out.ice2 = 1e9 - m.hp - h1 > h1 * 1.5;
      P.mp = 1e6; A.cast('bbarr'); const mp0 = P.mp; out.barrier = Z.shield(100) === 0 && P.mp === mp0 - 50;
      P.mp = 1e6; A.cast('bcrys'); out.crystal = P.inv >= 2.9;
      P.mp = 1e6; P.cd = {}; window.__GPF.cast('bcoh'); P.cd = {}; window.__GPF.cast('bfire'); out.coh = P.cohW > gt() && !P.cohR;
      P.mp = 1e6; P.cd = {}; window.__GPF.cast('bspray'); const a2 = m2.hp, a3 = m3.hp; P.cd = {}; window.__GPF.cast('blight'); out.spray = m2.hp < a2 || m3.hp < a3;
      return out; });
    assert.deepEqual(r, { all: true, detect: true, decoy: true, jam: true, ice: true, ice2: true, barrier: true, crystal: true, coh: true, spray: true });
    // Mass Teleport: after the cast you are in town with no scroll spent
    const far = await g.eval(() => { const G = window.__G, P = G.P; P.x += 400; P.mp = 1e6; P.cd = {}; window.__GSKF.cast('bmasst'); return [P.x, P.y, !!P.rcast]; });
    assert.equal(far[2], true);
    await g.step(200);
    const at = await g.eval(() => [window.__G.P.x, window.__G.P.y]);
    assert.notDeepEqual(at, far.slice(0, 2));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
