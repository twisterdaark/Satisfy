'use strict';
// v3.14 The legends by the novel, pass 1 (the owner 2026-10-26: "Go through every single class in-game, confirming they have their
// skills from the wiki and the novel. Especially the Legendary Ones"): Sword Energy, Pagma's Sword Dance, Kill, Transcended Link
// Flower, Divinity, Heart Sword - First Entrance, Space Sword's irreversible damage, Poetry that Praises the Sword.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('Pagma: the Sword Dance, Sword Energy, Kill, Divinity; the Sword Saint: Heart Sword, Space Sword', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, L = window.__GLG3, X = window.__GSS2, o = {};
      S.cls = 'pagma'; S.lv = 100; S.sk = {}; S.pgMur = 1; G.isk.checkSkills();
      o.ps = L.ps().map((x) => +x.toFixed(3)); o.sw = L.sw();
      // a dance stops the Sword Dance for 10 s
      const m = G.mons().find((q) => !q.dead && !G.isk.MT[q.type].boss); for (const q of G.mons()) if (q !== m && Math.hypot(q.x - P.x, q.y - P.y) < 400) { q.dead = true; q.rt = 1e9; }
      m.x = P.x + 24; m.y = P.y; m.hp = m.max = 1e9; P.dir = 2; P.mp = 1e6; P.st = 1e6; P.cd = {};
      // Kill: 20% of stamina (first: after Link it would make a fusion)
      const st0 = P.st = L.ms(); P.cd = {}; X.cast('kill'); o.killSt = (st0 - P.st) / st0; o.KILLM = +L.KILLM.toFixed(2);
      P.psOffU = 0; o.ps1 = L.ps()[0] > 0; P.cd = {}; X.cast('link'); o.ps2 = L.ps();
      // the fusions spend Sword Energy: refused with none
      P.swE = 0; P.cd = {}; o.se0 = L.cost('ddplkw'); S.lv = 30; o.seLow = [L.cost('ddplkw'), L.sw().max]; S.lv = 100;
      // Divinity: twice a blacksmithing skill despite its cooldown
      P.cd = {}; X.cast('pgdiv'); P.cd.lrep = 99; X.cast('lrep'); o.div = [P.divN, P.cd.lrep > 0];
      // the Sword Saint: Heart Sword - First Entrance, 10% of the target's health as a critical hit, half the Sword Energy
      S.cls = 'saint'; S.lv = 200; S.sk = {}; S.qs.ms3 = S.qs.ms3 || { st: 2 }; S.qs.ms1 = S.qs.ms1 || { st: 2 }; S.qs.ms2 = S.qs.ms2 || { st: 2 }; G.isk.checkSkills();
      m.hp = m.max = 1e6; P.cd = {}; P.swE = 0; X.cast('mwind'); o.hs0 = m.hp;
      P.swE = L.sw().max; const hp0 = P.hp; P.cd = {}; X.cast('mwind'); o.hs = [m.hp, P.swE, P.hp < hp0]; o.hsE = 1e6 - Math.round(Math.min(1e5, L.atk() * L.HSCAP) * 1.8);
      // a guard still holds against it, and it sets no hit record
      const rec = S.hitRec || 0; P.hp = G.maxHP(); m.hp = m.max = 1e6;   /* (full health: Body as a Blade halves a guard under 30%) */ m.wardT = 1e9; m.wardR = .4; P.swE = L.sw().max; P.cd = {}; X.cast('mwind'); o.hsW = (1e6 - m.hp) / (1e6 - o.hsE); o.rec = (S.hitRec || 0) === rec; m.wardT = 0;
      // a huge foe: capped at 2,000% of your attack
      m.hp = m.max = 1e12; P.swE = L.sw().max; P.cd = {}; X.cast('mwind'); o.hsCap = Math.round((1e12 - m.hp) / (L.atk() * 20 * 1.8) * 100);
      // Space Sword: irreversible damage and the weakness exposed
      m.hp = m.max = 1e9; P.cd = {}; X.cast('mcross'); o.sp = [m.irrU > 0, m.expU > 0, m.slowU > 0];
      // the next direct hit takes the exposed weakness
      window.__GU.hitMon(m, 1, {}); o.exp = m.expU;
      return o;
    });
    assert.deepEqual(r.ps, [0.28, 0.175, 0.05], 'Sword Dance Lv 1 (Lv 2 is 30/20/10)');
    assert.deepEqual(r.sw, { on: true, max: 300, v: 0 });
    assert.equal(r.ps1, true); assert.deepEqual(r.ps2, [0, 0, 0], 'a dance stops it');
    assert.equal(r.KILLM, 13.85); assert.ok(Math.abs(r.killSt - 0.2) < 0.01, 'Kill takes 20% of stamina: ' + r.killSt);
    assert.equal(r.se0, 150); assert.deepEqual(r.seLow, [90, 90], 'never more than the whole bar');
    assert.deepEqual(r.div, [1, true]);
    assert.equal(r.hs0, 1e6, 'no Heart Sword without Sword Energy');
    assert.equal(r.hs[0], r.hsE); assert.ok(Math.abs(r.hsW - 0.4) < 0.02, 'a guard holds: ' + r.hsW); assert.equal(r.rec, true, 'no hit record'); assert.equal(r.hsCap, 100, 'capped'); assert.ok(r.hs[1] >= 300 && r.hs[1] < 310, 'half spent: ' + r.hs[1]); assert.equal(r.hs[2], true);
    assert.deepEqual(r.sp, [true, true, true]); assert.equal(r.exp, 0, 'the next hit takes the weakness');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Lantier strikes whatever the level; Fated to Perish; the twin swords bind; the Massacre Sword and Pounding Mortar', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, X = window.__GSS2, o = {};
      const m = G.mons().find((q) => !q.dead && !G.isk.MT[q.type].boss); for (const q of G.mons()) if (q !== m && Math.hypot(q.x - P.x, q.y - P.y) < 600) { q.dead = true; q.rt = 1e9; }
      m.x = P.x + 24; m.y = P.y; m.hp = m.max = 1e9; m.lv = 400; P.dir = 2; P.mp = 1e6; P.st = 1e6;
      // a skill on a monster far above you: Lantier's isn't softened
      const hit = (cls) => { S.cls = cls; S.lv = 100; const h = m.hp; window.__GU.hitMon(m, 1, { skill: 1 }); return h - m.hp; };
      o.lan = hit('lantier'); o.knight = hit('knight');
      m.lv = 1; o.lanLo = hit('lantier'); o.knLo = hit('knight'); m.lv = 400;
      S.cls = 'lfarmer'; S.lv = 300; S.sk = {}; G.isk.checkSkills(); o.perish = !!S.sk.lfperish;
      S.cls = 'lknight'; S.lv = 100; S.sk = {}; G.isk.checkSkills(); o.dual = !!S.sk.lkdual; m.lv = 100; m.stun = 0; P.cd = {}; X.cast('lkdual'); o.bound = m.stun > 2;
      // the Massacre Sword: thirty cuts; Pounding Mortar: a foe far off in sight
      m.lv = 100; m.hp = m.max = 1e9; m.stun = 0; window.__mH = m.hp; window.__GSKF.cast('mamass');
      const far = G.mons().find((q) => q.dead && q !== m && !G.isk.MT[q.type].boss); if (far) { far.dead = false; far.rt = 0; far.hp = far.max = 1e9; far.x = P.x + 300; far.y = P.y; far.lv = 100; window.__far = far; }
      return o;
    });
    await g.eval(() => new Promise((res) => setTimeout(res, 1200)));
    const ma = await g.eval(() => { const m = window.__G.mons().find((q) => q.max === 1e9 && q.x < window.__G.P.x + 50 && !q.dead); const d = window.__mH - m.hp; window.__GSKF.cast('lfmortar'); return { d, far: !!window.__far }; });
    await g.eval(() => new Promise((res) => setTimeout(res, 2600)));   /* the poundings run on the clock */
    await g.step(5);
    const mo = await g.eval(() => window.__far ? 1e9 - window.__far.hp : -1);
    assert.ok(ma.d > 0, 'the Massacre Sword cuts'); assert.equal(ma.far, true); assert.ok(mo > 0, 'the Mortar reaches a foe 300 px off in sight: ' + mo);
    assert.ok(r.lanLo >= r.knLo, 'a weaker foe still takes more from Lantier: ' + r.lanLo + ' vs ' + r.knLo);
    assert.ok(r.lan > r.knight * 3, 'no level gap on Lantier\'s skills: ' + r.lan + ' vs ' + r.knight);
    assert.equal(r.perish, true); assert.equal(r.dual, true); assert.equal(r.bound, true);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
