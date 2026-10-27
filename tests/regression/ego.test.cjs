'use strict';
// Owner 2026-10-27 23:50: sentient weapons (egos): eight spirits as permutations on any weapon, always Unique or Legendary,
// one in hand at a time, 0.5% to replace a weapon drop, and Pagma's Successor binds one for 50 levels.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

test('an ego on any weapon: rating raised, the numbers, only the one in hand counts', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, E = window.__GEGO, X = G.eqx, o = {};
      const w0 = { id: 'isword' };
      const it = X.mkItem(w0.id, 0); S.items.push(it); const a0 = it.atk;
      E.make(it, 'greed'); o.r = it.r; o.atkUp = it.atk > a0; o.ego = it.ego; o.tip = E.tip(it);
      o.bag = E.of();   // in the bag: not yet
      X.equip(it); o.of = E.of(); o.dm = E.v('dm');
      const mk = (k) => { const x = X.mkItem(w0.id, 3); E.make(x, k); return x; };
      const aeg = mk('aegis'); S.items.push(aeg); X.equip(aeg); o.def = X.defV(); o.greedOff = E.v('dm');
      const fr = mk('frost'); S.items.push(fr); X.equip(fr); o.cd = X.atkCD();
      // two egos in the bag, one in hand
      o.count = S.items.filter((i) => i.ego).length; o.inHand = E.of();
      return o;
    });
    assert.ok(r.r >= 3, 'Unique at least: ' + r.r); assert.ok(r.atkUp, 'its attack recomputed for the rating');
    assert.equal(r.ego, 'greed'); assert.ok(/Spirit of Greed/.test(r.tip));
    assert.equal(r.bag, null, 'a spirit in the bag does nothing');
    assert.equal(r.of, 'greed'); assert.ok(near(r.dm, 0.2));
    assert.equal(r.greedOff, 0, 'another weapon in hand: Greed is off');
    assert.equal(r.count, 3); assert.equal(r.inHand, 'frost', 'only the one in hand');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the drop: 0.5% of weapon drops, never armour', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, E = window.__GEGO, X = G.eqx, o = { w: 0, n: 20000 };
      const wid = 'isword';
      for (let i = 0; i < o.n; i++) { const it = X.mkItem(wid, 2); E.drop(it); if (it.ego) { o.w++; o.r = Math.min(o.r || 9, it.r); } }
      const arm = G.S.items.find((i) => i.slot !== 'w') || { slot: 'a', id: 'x' }; let a = 0; for (let i = 0; i < 3000; i++) { const it = { ...arm }; E.drop(it); if (it.ego) a++; } o.arm = a;
      return o;
    });
    assert.ok(r.w > 50 && r.w < 160, 'about 100 in 20000: ' + r.w);
    assert.ok(r.r >= 3, 'a dropped ego is Unique or better');
    assert.equal(r.arm, 0);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the spirits in combat: execute, life on crits, precision, knockdown, deflection, shadow guard, penetration', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, E = window.__GEGO, X = G.eqx, o = {};
      const wear = (k) => { const x = X.mkItem('isword', 3); E.make(x, k); S.items.push(x); X.equip(x); return x; };
      const mob = (ex) => Object.assign({ type: 'wolf', lv: S.lv, x: P.x + 30, y: P.y, hp: 100, max: 1000 }, ex || {});
      // Greed: a blow leaving an ordinary foe under 10% is taken all the way (15%); a boss never
      wear('greed'); let ex = 0, bx = 0; for (let i = 0; i < 2000; i++) { if (E.exec(mob(), 20, {}) === 100) ex++; if (E.exec(mob({ type: 'dcapt' }), 20, {}) === 100) bx++; }
      o.exec = ex; o.bossExec = bx; o.exHigh = E.exec(mob({ hp: 900 }), 20, {});
      P.hp = 10; E.hit(mob(), 1000, true, {}); o.ls = P.hp > 10;
      // Frostfang: +2% for each hit after the first on the same foe, to 20%
      wear('frost'); const m1 = mob(), m2 = mob(); for (let i = 0; i < 4; i++)E.hit(m1, 1, false, {}); o.cr4 = E.cr(); for (let i = 0; i < 20; i++)E.hit(m1, 1, false, {}); o.crMax = E.cr(); E.hit(m2, 1, false, {}); o.crNew = E.cr();
      // the Iron Monarch: every third swing knocks down
      wear('monarch'); const kd = []; for (let i = 0; i < 6; i++) { P.egoN = i; P.egoKD = (i + 1) % 3 === 0; const m = mob({ stun: 0 }); E.hit(m, 1, false, {}); kd.push(m.stun > 1); } o.kd = kd;
      // the Aegis: a blow from behind is deflected once in 15 s
      wear('aegis'); P.dir = 2; P.egoDfT = 0; const back = mob({ x: P.x - 30, y: P.y, dead: false }); o.dfl = E.guard(back); o.dfl2 = E.guard(back) === 2;
      // the Phantom Stalker: a killing blow, 12%, finds you gone
      wear('stalker'); let sg = 0; for (let i = 0; i < 400; i++) { P.egoSgT = 0; P.hp = 5; if (E.dodge(50, mob())) sg++; } o.sg = sg; P.egoSgT = 0; P.hp = 500; o.noFatal = E.dodge(50, mob());
      // the Reaper: penetration against a stronger foe, and Reaper's Command on the bar
      wear('reaper'); o.pen = E.atk(mob({ lv: S.lv + 60 }), {}); o.penEven = E.atk(mob(), {}); o.reapSk = window.__GRZ.skills().includes('egreap');
      return o;
    });
    assert.ok(r.exec > 200 && r.exec < 420, 'about 15%: ' + r.exec); assert.equal(r.bossExec, 0, 'never a boss'); assert.equal(r.exHigh, 20, 'not above 10%');
    assert.ok(r.ls, 'life on a critical hit');
    assert.ok(near(r.cr4, 0.06), 'three hits after the first: ' + r.cr4); assert.ok(near(r.crMax, 0.2)); assert.equal(r.crNew, 0, 'a new target starts again');
    assert.deepEqual(r.kd, [false, false, true, false, false, true]);
    assert.equal(r.dfl, 2, 'deflected'); assert.equal(r.dfl2, false, 'once every 15 s');
    assert.ok(r.sg > 25 && r.sg < 75, 'about 12%: ' + r.sg); assert.equal(r.noFatal, false, 'only a killing blow');
    assert.ok(r.pen > 1, 'penetration against a stronger foe: ' + r.pen); assert.equal(r.penEven, 1);
    assert.ok(r.reapSk);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the actives and the echo', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(async () => {
      const G = window.__G, S = G.S, P = G.P, E = window.__GEGO, X = G.eqx, o = {};
      const wear = (k) => { const x = X.mkItem('isword', 3); E.make(x, k); S.items.push(x); X.equip(x); return x; };
      S.lv = 200; P.mp = 1e6;
      wear('reaper'); const ms = G.mons().filter((m) => !m.dead && !G.QD[m.type]).slice(0, 1); const m = ms[0];
      if (m) { m.x = P.x + 30; m.y = P.y; m.dead = false; m.hp = m.max; }
      P.cd = {}; window.__GRZ.cast('egreap'); o.reapCd = (P.cd.egreap || 0) > 50; o.fled = m ? (m.flee > 0 || m.stun > 0 || m.dead) : true;
      wear('dragon'); P.cd = {}; window.__GRZ.cast('egdrag'); o.dragCd = (P.cd.egdrag || 0) > 80; o.dragSk = window.__GRZ.skills().includes('egdrag') && !window.__GRZ.skills().includes('egreap');
      // an echo: every step of it deals half, the shots it lets fly too, and the flag is gone after
      wear('arch'); const m3 = { type: 'wolf', lv: S.lv, x: P.x + 400, y: P.y };
      o.ech = await new Promise((res) => { const seen = []; window.__GEGO.echo('egdrag', () => { seen.push(window.__GEGO.atk(m3, {})); G.proj.push({ x: -1e6, y: -1e6, vx: 0, vy: 0, t: .01, mul: 2 });
        setTimeout(() => { seen.push(window.__GEGO.atk(m3, {})); setTimeout(() => { seen.push(window.__GEGO.atk(m3, {})); res({ seen, after: window.__GEGO.E }); }, 10); }, 10); }); });
      o.projMul = (G.proj.find((p) => p.x === -1e6) || {}).mul; o.now = window.__GEGO.E;
      return o;
    });
    assert.ok(r.reapCd, 'Reaper\'s Command: a 60 s cooldown'); assert.ok(r.fled, 'the foe flees or staggers');
    assert.ok(r.dragCd); assert.ok(r.dragSk, 'only the spirit in hand gives its skill');
    assert.deepEqual(r.ech.seen, [0.5, 0.5, 0.5], 'every step of an echo deals half');
    assert.equal(r.projMul, 1, 'a shot it lets fly too'); assert.equal(r.now, 0);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test("Pagma's Successor binds a spirit at the anvil for 50 levels", async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, E = window.__GEGO, X = G.eqx, o = {};
      const it = X.mkItem('isword', 1); S.items.push(it);
      S.cls = 'smith'; S.lv = 120; o.notPagma = E.craft(it.uid, 'dragon');
      S.cls = 'pagma'; S.lv = 50; o.low = E.craft(it.uid, 'dragon');
      S.lv = 120; S.pts = 30; const st0 = Object.values(S.st).reduce((a, b) => a + b, 0);
      o.ok = E.craft(it.uid, 'dragon'); o.lv = S.lv; o.ego = it.ego; o.r = it.r; o.egc = it.egc; o.pts = S.pts; o.stDown = Object.values(S.st).reduce((a, b) => a + b, 0) < st0;
      o.again = E.craft(it.uid, 'greed');
      X.openForge(); o.btn = !!document.querySelector('[data-act="fEgo"]');
      return o;
    });
    assert.equal(r.notPagma, false); assert.equal(r.low, false, 'not under Lv 51');
    assert.equal(r.ok, true); assert.equal(r.lv, 70, '50 levels'); assert.equal(r.ego, 'dragon'); assert.ok(r.r >= 3); assert.equal(r.egc, 1);
    assert.equal(r.pts, 0, 'unspent points go first'); assert.ok(r.stDown, 'then stat points');
    assert.equal(r.again, false, 'one spirit to a weapon');
    assert.ok(r.btn, 'the anvil has the button');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
