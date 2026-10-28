'use strict';
// v3.23 The plan's updates, batch 3: U129 the drake breathes a cone of fire, U118 the Forest Bear charges into walls and
// tears your armour, U116 the Goblin Chief stuns with a stomp, U128 wyverns land after a dive and fear arrows in the air,
// U142 the bats hunt by ear, U130 the Hydra's heads, U301 the race's posts. (U303 photo mode's free camera is in
// regression/mpack.)
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the plan, batch 3: the monsters', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, X = window.__GMX3, o = {};
      for (const q of G.mons()) { q.dead = true; q.rt = 1e9; }
      const mvs = (k) => X.movesOf({ type: k });
      // the drake's breath: everything in the wedge burns, nothing behind it
      const dr = G.spawnMon('drake', P.x - 40, P.y); dr.lv = 1; const cone = mvs('drake').find((v) => v.k === 'cone');
      o.cone = !!cone && cone.dot && cone.dot[2] === 'fire';
      const breathe = (dx) => { let lost = 0; for (let i = 0; i < 12; i++) { P.hp = G.maxHP(); P.inv = 0; P.dash = 0; P.dotT = 0; dr.ax = 1; dr.ay = 0; X.MXK.cone(dr, G.isk.MT.drake, cone, Math.abs(dx), dx, 0, 0); lost += G.maxHP() - P.hp; } return lost; };
      o.front = breathe(40); o.behind = breathe(-40); o.far = breathe(90);
      dr.dead = true;
      // the Forest Bear: a charge that stops at walls, and a swipe that tears armour (Purification mends it)
      const bm = mvs('bear'); o.bear = [bm.some((v) => v.k === 'line' && v.wall), bm.some((v) => v.k === 'arc' && v.shred > 0)];
      S.st.sta = 4000; const d0 = X.defV(); P.shredT = window.__GLG3.now() + 6; const d1 = X.defV(); window.__GCL2.clean(); const d2 = X.defV();
      o.shred = [d0 > 0, Math.abs(d1 / d0 - X.SHR) < 0.02, d2 === d0];
      // the Goblin Chief: a stunning stomp once the fight turns
      o.chief = mvs('gchief').some((v) => v.k === 'ring' && v.stun > 0 && v.ph === 1);
      // wyverns: down on the ground after a dive, 25% more; in the air an arrow does 30% more, a sword nothing more
      const wy = G.spawnMon('wyvern', P.x + 60, P.y); X.wyLand(wy); o.land = [wy.st === 'rec', wy.stT >= 2, X.wyAtk(wy, {})];
      wy.landU = 0; o.air = X.wyAtk(wy, {}); o.drake = X.wyAtk({ type: 'drake' }, {});
      // the bats hear you: standing still they lose you, riding they hear you from further off; fog and stealth don't blind them
      P.stillT = 2; P.dash = 0; P.ride = 0; P.stl = 0; o.still = X.hearAg(); P.stillT = 0; o.walk = X.hearAg(); P.dash = 0.2; o.run = X.hearAg(); P.dash = 0;
      P.stl = 5; o.stl = X.hearAg(); P.stl = 0; o.hear = ['cbat', 'bswarm', 'vbat'].every((k) => X.HEAR.has(k)) && !X.HEAR.has('wolf');
      // the Hydra's heads: one falls every 15% of its health; fire sears the stump, or two heads grow from it in 6 s
      const hy = G.spawnMon('hydra', P.x + 80, P.y); hy.max = hy.hp = 1e9; hy.lv = 1; X.hyTick(hy); o.hy0 = hy.hd;
      hy.hp = hy.max * 0.84; X.hyTick(hy); o.hy1 = [hy.hd, hy.hst];
      window.__GU.hitMon(hy, 1, { el: 'fire' }); o.hy2 = hy.hst; hy.hsU = window.__GLG3.now() - 1; X.hyTick(hy); o.hy3 = hy.hd;
      hy.hp = hy.max * 0.69; X.hyTick(hy); hy.hsU = window.__GLG3.now() - 1; X.hyTick(hy); o.hy4 = hy.hd;
      hy.hp = hy.max * 0.05; X.hyTick(hy); o.hy5 = hy.hd; hy.dead = true;
      return o;
    });
    assert.deepEqual([r.hy0, r.hy1, r.hy2, r.hy3], [3, [2, 1], 0, 2], 'U130: a head falls, and fire sears the stump');
    assert.equal(r.hy4, 3, 'an unseared stump grows two heads'); assert.equal(r.hy5, 1, 'never fewer than one');
    assert.equal(r.cone, true, 'U129: the drake has a fire breath');
    assert.ok(r.front > 0, 'in the wedge it burns: ' + r.front); assert.equal(r.behind, 0, 'not behind it'); assert.equal(r.far, 0, 'nor beyond its reach');
    assert.deepEqual(r.bear, [true, true], 'U118: the bear charges into walls and tears armour');
    assert.deepEqual(r.shred, [true, true, true], 'torn armour: 30% less defence, mended by Purification');
    assert.equal(r.chief, true, 'U116: the chief stuns');
    assert.deepEqual(r.land, [true, true, 1.25], 'U128: a wyvern on the ground after a dive');
    assert.equal(r.air, 1, 'in the air, a sword does no more'); assert.equal(r.drake, 1);
    assert.deepEqual([r.still, r.walk, r.run, r.stl], [0.35, 1, 1.45, 0.6], 'U142: the bats hear you');
    assert.equal(r.hear, true);
    // in the air, an arrow does 30% more
    const bow = await g.eval(() => { const G = window.__G, S = G.S; const it = G.isk.mkItem('bow', 1, 1); S.items.push(it); G.isk.equip(it); const w = G.mons().find((m) => m.type === 'wyvern' && !m.dead); w.landU = 0; return [window.__GMX3.wyAtk(w, {}), window.__GMX3.wyAtk(w, { dot: 1 })]; });
    assert.deepEqual(bow, [1.3, 1], 'an arrow on a flying wyvern, not its poison ticks');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// U301: the race's posts. The clock is moved as regression/townlife moves it.
const RCS = 3600000, RCG = RCS - 46000, RCGO = RCS - 40000;
const raceClock = (g, ms) => g.eval((ms) => {
  if (!window.__realNow) { const t0 = Date.now(); window.__realNow = () => t0; }
  if (window.__raceSlot == null) window.__raceSlot = Math.floor(window.__realNow() / 3600000) + 1;
  window.__off = window.__raceSlot * 3600000 + ms - window.__realNow(); Date.now = () => window.__realNow() + window.__off;
}, ms);
const goTo = async (g, a, b) => { const n = Math.ceil(Math.abs(b - a) / 0.1); for (let i = 1; i <= n; i++) { await g.eval((p) => { const q = window.__GTL.rcPos(p, 0); window.__G.P.x = q.x; window.__G.P.y = q.y; }, a + (b - a) * i / n); await g.step(1); } };
const jump = (g, p) => g.eval((p) => { const q = window.__GTL.rcPos(p, 0); window.__G.P.x = q.x; window.__G.P.y = q.y; }, p).then(() => g.step(1));
const race = (g) => g.eval(() => ({ p: +window.__GTL.RCR.p.toFixed(2), n: window.__GTL.RCR.cpN }));

test('the plan, batch 3: the race posts', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { window.__G.S.lv = 20; window.__GTL.setFS(1); });
    await raceClock(g, RCG - 20000);
    await g.eval(() => { const G = window.__G, n = G.npcs.find((n) => n.id === 'rcS'); G.P.x = n.x; G.P.y = n.y + 16; });
    await g.step(3);
    await g.eval(() => window.__G.talkNPC('rcS')); await g.step(2);
    await g.eval(() => { const G = window.__G; for (let i = 0; i < 6 && !(G.DL && G.DL.optOn); i++) G.advance(); });
    await g.eval(() => window.__G.pickOpt(0)); await g.step(2);
    await raceClock(g, RCG + 200); await g.step(3); await g.page.waitForTimeout(500); await g.step(3);
    await raceClock(g, RCGO + 100); await g.step(2);
    assert.equal(await g.eval(() => window.__GTL.RCR.go), true, 'the race is on');
    // a fair stretch past the first post (a quarter lap)
    await goTo(g, -0.08, 2.0);
    let r = await race(g); assert.equal(r.n, 2, 'the first post passed'); assert.ok(Math.abs(r.p - 2.0) < 0.15, 'the run counts: ' + r.p);
    // a blink across the infield, past the second post: nothing counts beyond it, however far you go on
    await jump(g, 4.5); await goTo(g, 4.5, 5.5);
    r = await race(g); assert.equal(r.n, 2, 'the second post was missed'); assert.ok(r.p <= Math.PI + 0.31, 'held at the missed post: ' + r.p);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
