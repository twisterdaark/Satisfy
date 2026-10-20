'use strict';
// Great demons (major 12, novel ch 1018-1055): the 22nd Great Demon Berith at Fort Taleren. The lie of invincibility
// (75/50/25%: no damage reaches him, his blows double), his distorted reality (60/35%: skills taken for 12 s near him), +20%
// and debuffs cleared at 30%, the hell that stops natural restoration near him, and a reward by each player's part.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('Fort Taleren and Berith: the lie, the distorted reality, +20%, the hell, the reward by part and the shared rest', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const w = await g.eval(() => { const G = window.__G, B = window.__GBR, m = B.of(), T = B.TALE; let wall = 0, gate = 0; for (let y = 130; y < 158; y++) { const s = G.eqx.solid(T.wx, y); if (s) wall++; }
      for (let x = T.x0; x <= T.x1; x++) if (G.eqx.solid(x, Math.floor(m.y / 16))) gate++;
      return { z: G.zoneAt(m.x, m.y), lv: m.lv, boss: !!G.MT, wall, gate, demons: G.mons().filter((o) => o.type === 'hdemon').length }; });
    assert.equal(w.z, 'zTaleren'); assert.equal(w.lv, 450);
    assert.ok(w.wall >= 10, 'the fort wall: ' + JSON.stringify(w)); assert.equal(w.gate, 0, 'the road runs through the gate');
    assert.ok(w.demons >= 3, 'his army');
    // stand by him (made harmless for the test) and walk his health down
    const r = await g.eval(() => {
      const G = window.__G, B = window.__GBR, P = G.P, m = B.of(), o = {};
      for (const x of G.mons()) if (x !== m) { x.dead = true; x.rt = 1e9; }
      P.x = m.x - 60; P.y = m.y; m.stun = 1e9; m.eng = 4; m.agg = 1; G.S.lv = 420; G.gainXP(1); P.hp = 1e9;
      const step = (f) => { m.hp = Math.floor(m.max * f); B.tick(0.016); };
      step(0.9); o.before = B.imm(m);
      step(0.74); o.lie = B.imm(m); const h = m.hp; o.dmg0 = B.hit(m, 1); o.hpSame = m.hp === h; o.hurt2 = B.hurt(1000, m);
      step(0.59); o.seal = B.seal(); o.hell = B.hell();
      return o;
    });
    // the hell: a second of play near him gives no mana back
    await g.eval(() => { const G = window.__G, m = window.__GBR.of(); G.P.mp = 1; m.eng = 4; });
    await g.step(40);
    const mp = await g.eval(() => window.__G.P.mp);
    const r2 = await g.eval(() => {
      const G = window.__G, B = window.__GBR, m = B.of(), o = {};
      m.brInv = 0; m.weak = 5; m.mk = 5; m.hp = Math.floor(m.max * 0.29); B.tick(0.016); m.brInv = 0; o.up = m.brUp === 1; o.cleared = !m.weak && !m.mk; o.hurtUp = B.hurt(1000, m);
      m.brInv = 0; m.stun = 1e9; const h2 = m.hp; o.dmg1 = B.hit(m, 1) > 0 && m.hp < h2;
      // the reward: 6% of his health is yours; his two-hour rest is written for the world
      m.brMy = Math.round(m.max * 0.06); const tl = !!G.S.tl.savior; B.down(m); o.title = [tl, !!G.S.tl.savior]; o.rest = Math.round((B.wb() - Date.now()) / 60000);
      return o;
    });
    assert.equal(r.before, false);
    assert.equal(r.lie, true); assert.equal(r.dmg0, 0); assert.equal(r.hpSame, true); assert.equal(r.hurt2, 2000);
    assert.equal(r.seal, true);
    assert.equal(r.hell, true); assert.ok(mp < 1.01, 'no mana back in the hell: ' + mp);
    assert.equal(r2.up, true); assert.equal(r2.cleared, true); assert.equal(r2.hurtUp, 1200);
    assert.equal(r2.dmg1, true);
    assert.deepEqual(r2.title, [false, true]);
    assert.equal(r2.rest, 120);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the lie and the seal follow his health on any screen; a skill is refused while sealed and works after', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, B = window.__GBR, P = G.P, m = B.of();
      for (const x of G.mons()) if (x !== m) { x.dead = true; x.rt = 1e9; }
      G.S.cls = 'warrior'; G.S.lv = 20; G.gainXP(1); P.mp = 100; P.x = m.x - 60; P.y = m.y; m.stun = 1e9;
      // a follower's copy: its health is set from the host's list, not by its own hits
      m.hp = Math.floor(m.max * 0.58); B.tick(0.016);
      const o = { inv: B.imm(m), seal: B.seal(), phases: [m.brI, m.brD] };
      const cd0 = JSON.stringify(P.cd); G.useSlot(0); o.refused = JSON.stringify(P.cd) === cd0;
      P.brSeal = 0; G.useSlot(0); o.after = JSON.stringify(P.cd) !== cd0;
      // far away: the reality does not reach you
      P.brSeal = 0; P.x = m.x - 600; m.hp = Math.floor(m.max * 0.34); B.tick(0.016); o.farSeal = B.seal();
      // healed to full (after a leash), the phases start over
      m.hp = m.max; B.tick(0.016); o.reset = [m.brI, m.brD, m.brUp];
      return o;
    });
    assert.deepEqual(r.phases, [1, 1], 'one lie and one distortion passed: ' + JSON.stringify(r));
    assert.equal(r.inv, true); assert.equal(r.seal, true);
    assert.equal(r.refused, true); assert.equal(r.after, true);
    assert.equal(r.farSeal, false);
    assert.deepEqual(r.reset, [0, 0, 0]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
