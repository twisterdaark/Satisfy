'use strict';
// v3.15 The classes by the novel, pass 2 (the class audit, docs/content/CLASS_AUDIT.md): Purification, God Judar's Blessing,
// Diamond Barrier, Guardian Knight's Nature, Multi-shot, Morale Boost, the Martial Artist's weak point, the Duplicator's copies.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the second pass: each class gets the novel\'s skills', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, X = window.__GSS2, C = window.__GCL2, o = {};
      const be = (cls, lv, extra) => { S.cls = cls; S.lv = lv; S.sk = {}; Object.assign(S, extra || {}); P.mp = 1e6; P.cd = {}; G.isk.checkSkills(); };
      const m = G.mons().find((q) => !q.dead && !G.isk.MT[q.type].boss); for (const q of G.mons()) if (q !== m && Math.hypot(q.x - P.x, q.y - P.y) < 400) { q.dead = true; q.rt = 1e9; }
      m.x = P.x + 30; m.y = P.y; m.hp = m.max = 1e9;
      be('saintess', 40); o.pur = !!S.sk.sapur; P.stun = 3; P.slowT = P.rootT = P.dotT = 1e12; P.dotP = .1; X.cast('sapur'); o.pur2 = [P.stun, P.slowT, P.rootT, P.dotT];
      be('paladin', 120, { church: 'judar' }); o.gjb = !!S.sk.gjbless; const hp0 = G.maxHP(); X.cast('gjbless'); o.gjb2 = Math.round(G.maxHP() / hp0 * 100);
      be('warlock', 240); o.dia = !!S.sk.wldiam; X.cast('wldiam'); P.inv = 0; const hd = P.hp; X.hurt(100, m); o.dia2 = P.hp === hd;
      be('archer', 20); o.multi = !!S.sk.amulti; const p0 = G.proj.length; window.__GSKF.cast('amulti'); o.multi2 = G.proj.length - p0;
      be('orator', 50); o.mor = !!S.sk.omorale; X.cast('omorale'); o.mor2 = P.morN === 1;
      be('gknight', 30); o.nat = !!S.sk.gknat; o.dbreak = !!S.sk.gkdbreak; P.wdiaU = 0; P.inv = 0; P.hp = G.maxHP(); X.hurt(G.maxHP() * .6, m); window.__gkH = P.hp; o.gkLost = G.maxHP() - P.hp > G.maxHP() * .2;
      be('martial', 60); o.weak = !!S.sk.maweak && !!S.sk.mafist; m.lv = S.lv + 40; o.pen = C.pen(m) > 1; m.lv = 1;
      // the Duplicator: an observation can fail; three a day; each copy used once
      be('dupl', 130); S.dpCopy = null; for (let i = 0; i < 40 && !S.dpCopy; i++) { C.dly().dpn = 0; window.__GSKF.cast('dpobs'); } o.obs = !!S.dpCopy;
      window.__GSKF.cast('dpdup'); o.dup = !S.dpCopy;
      C.dly().dpn = 0; for (let i = 0; i < 4; i++) window.__GSKF.cast('dpobs'); o.day = C.dly().dpn;
      return o;
    });
    assert.equal(r.pur, true); assert.deepEqual(r.pur2, [0, 0, 0, 0], 'Purification clears the stun, slow, root and poison');
    assert.equal(r.gjb, true); assert.ok(r.gjb2 >= 130, "God Judar's Blessing: health +30% (and more from its +20% stats): " + r.gjb2);
    assert.deepEqual([r.dia, r.dia2], [true, true], 'Diamond Barrier takes the blow');
    assert.equal(r.multi, true); assert.equal(r.multi2, 7, 'Multi-shot: seven arrows');
    assert.deepEqual([r.mor, r.mor2], [true, true], 'Morale Boost');
    assert.deepEqual([r.nat, r.dbreak, r.gkLost], [true, true, true]);
    await g.eval(() => new Promise((res) => setTimeout(res, 700)));
    assert.ok(await g.eval(() => window.__G.P.hp > window.__gkH), "Guardian Knight's Nature: half a great blow comes back");
    assert.equal(r.weak, true); assert.equal(r.pen, true, 'the weak point undoes part of the level gap');
    assert.equal(r.obs, true); assert.equal(r.dup, true, 'a copy is used once'); assert.equal(r.day, 3, 'three observations a day');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the legendary pass: the Bow Saint\'s close counter, Mercedes\' Sword Energy and shield, the Goddess\' Agent\'s Sword Mastery', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, X = window.__GSS2, C = window.__GCL2, o = {};
      const be = (cls, lv) => { S.cls = cls; S.lv = lv; S.sk = {}; P.mp = 1e6; P.cd = {}; P.inv = 0; G.isk.checkSkills(); };
      const m = G.mons().find((q) => !q.dead && !G.isk.MT[q.type].boss); for (const q of G.mons()) if (q !== m && Math.hypot(q.x - P.x, q.y - P.y) < 400) { q.dead = true; q.rt = 1e9; }
      m.x = P.x + 30; m.y = P.y; m.hp = m.max = 1e9; P.dir = 2; window.__m = m;
      // the Bow Saint's stealth arrows find the foe behind you, without aim (on their own: nothing else hits it meanwhile)
      be('bowsaint', 60); o.gh = !!S.sk.bsghost; P.dir = 3; window.__hg = m.hp; window.__GSKF.cast('bsghost');
      return o;
    });
    await g.eval(() => new Promise((res) => setTimeout(res, 400)));
    const gh = await g.eval(() => window.__m.hp < window.__hg);
    const r2 = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, X = window.__GSS2, C = window.__GCL2, o = {}, m = window.__m;
      const be = (cls, lv) => { S.cls = cls; S.lv = lv; S.sk = {}; P.mp = 1e6; P.cd = {}; P.inv = 0; G.isk.checkSkills(); };
      P.dir = 2;
      be('bowsaint', 30); o.ctr = !!S.sk.bsctr; X.cast('bsctr'); const hp0 = P.hp, mh = m.hp; o.ctr2 = [X.hurt(400, m), P.hp === hp0, m.hp < mh, m.stun > 0];
      P.inv = 0; o.ctr3 = X.hurt(5, m) > 0;
      be('lknight', 40); o.lk = [!!S.sk.lkse, !!S.sk.lkthrow]; const n0 = C.shd(); X.cast('lkthrow'); o.lk2 = C.shd() - n0;
      be('gagent', 160); o.ga = !!S.sk.gaswm; o.ga2 = Math.round(C.cps('atk') * 100);
      // the Saintess' Holy Weapon and Mercedes' codes go out to the party ('D', 'C')
      be('saintess', 120); X.cast('sahw'); o.stD = window.__GC2.st().includes('D');
      be('lknight', 120); o.stC = window.__GC2.st().includes('C');
      // the Ice Mystic's attacks slow (a class pack's slow took no hold before v3.15)
      be('icemys', 80); m.slowU = 0; m.stun = 0; X.cast('imweb'); o.slow = m.slowU > 0 ? 1 : 0;
      return o;
    });
    Object.assign(r, r2);
    assert.equal(r.ctr, true); assert.deepEqual(r.ctr2, [0, true, true, true], 'the blow does nothing and a kick answers it'); assert.equal(r.ctr3, true, 'only the first');
    assert.deepEqual(r.lk, [true, true]); assert.equal(r.lk2, 1, 'the shield flies');
    assert.equal(r.ga, true); assert.ok(r.ga2 >= 12, 'a sword: +12% at least: ' + r.ga2);
    assert.equal(r.slow, 1, 'Ice Spider Web slows');
    assert.equal(r.gh, true); assert.deepEqual([r.stD, r.stC], [true, true], 'the party statuses');
    assert.equal(gh, true, 'a stealth arrow found the foe behind you');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
