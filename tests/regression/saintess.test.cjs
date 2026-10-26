'use strict';
// The Saintess as in the novel (ch200, ch494, ch1461; legends/legend-audit.md §5): Hope, Discipline, Benevolent Light, Upright
// Heart and Sacrifice from the class change, Holy Weapon, Holy Impact, and Sanctuary Declaration at level 380.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());
const LOOK = { n: 'Ruby', hair: 1, hc: 2, skin: 1, top: 3 };

test('the Saintess heals, resists, fears the corrupt away and gives everything in Sacrifice', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, A = window.__GSKF, X = window.__GSA, out = {};
      S.cls = 'saintess'; S.lv = 40; G.isk.checkSkills();
      out.l40 = ['sahope', 'sadisc', 'sapray', 'sagrace', 'salife', 'sahw', 'sahi', 'sasanc'].filter((k) => S.sk[k]);
      out.imm = X.imm();
      for (const m of G.mons()) m.dead = true;
      const d = G.spawnMon('demon', P.x + 30, P.y), w = G.spawnMon('wolf', P.x - 30, P.y);
      for (const m of [d, w]) { m.max = m.hp = 1e9; m.tmp = 0; m.lv = 1; }
      out.evil = [X.evil(d), X.evil(w)];
      P.hp = 1; P.mp = 1e6; A.cast('sahope'); out.hope = P.hp - 1;
      S.lv = 400; G.isk.checkSkills(); P.mp = 1e6; A.cast('sahi'); out.hi = [1e9 - d.hp, 1e9 - w.hp];
      P.hp = G.maxHP(); A.cast('salife'); out.sac = [P.hp, Math.round(P.mp)];
      return out; });
    assert.deepEqual(r.l40, ['sahope', 'sadisc', 'sapray', 'sagrace', 'salife']);
    assert.equal(r.imm, true, 'Upright Heart');
    assert.deepEqual(r.evil, [true, false]);
    assert.ok(r.hope > 0);
    assert.ok(r.hi[0] > r.hi[1] * 2, 'Holy Impact burns the corrupt hardest: ' + r.hi);
    assert.deepEqual(r.sac, [1, 1]);
    // (v3.18, ch 1461, 1463) the sanctuary takes an hour of building: basic magic only, one spell every 3 minutes, no blows,
    // a step breaks it; then 3 hours, 100 m, kept in the save; a new one inside it joins and grows it; 2 h 30 min cooldown
    const s = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, A = window.__GSA, o = {};
      P.mp = 1e6; P.cd = {}; window.__GSKF.cast('sasanc'); o.building = !!P.sncC && Math.round(A.K.SNCBUILD / 60); o.cdAtStart = S.sncCd > Date.now();
      P.cd = {}; window.__GSS2.cast('sahi'); o.noHi = (P.cd.sahi || 0) === 0;   /* not basic: refused */
      P.cd = {}; window.__GSS2.cast('sadisc'); o.disc = P.cd.sadisc > 0; P.cd = {}; window.__GSS2.cast('sadisc'); o.disc2 = !P.cd.sadisc;   /* one in 3 minutes */
      const mp0 = P.mp; A.tick(1); o.noRegen = P.mp <= mp0;
      P.sncC.e = A.K.SNCBUILD; A.tick(.01); const z = A.sanc(); o.sanc = !!z && z.r; o.saved = !!S.sanc && S.sncCd > Date.now(); o.inv = P.inv;
      // inside: monsters' special effects don't take hold
      P.slowT = 0; window.__GMV.mxOn({ slow: 5 }, null); o.immune = !(P.slowT > 0);
      // a reload: the save brings it back
      const keep = S.sanc; window.__GSA.load(); o.back = !!A.sanc() && A.sanc().r === keep.r;
      // the cooldown is on the clock: a recast is refused
      P.cd = {}; window.__GSKF.cast('sasanc'); o.cdHold = !P.sncC && P.cd.sasanc > 8000;
      // joining: a new one declared inside grows it
      S.sncCd = 0; P.cd = {}; window.__GSKF.cast('sasanc'); P.sncC.e = A.K.SNCBUILD; A.tick(.01); o.join = A.sanc().r;
      // a step breaks the building
      S.sncCd = 0; P.cd = {}; window.__GSKF.cast('sasanc'); P.x += 20; A.tick(.01); o.broke = !P.sncC && !S.sncCd;
      return o; });
    assert.equal(s.building, 60, 'an hour'); assert.equal(s.cdAtStart, true, 'the clock starts with the build'); assert.equal(s.noRegen, true, 'no mana back while building'); assert.equal(s.noHi, true, 'only basic magic'); assert.deepEqual([s.disc, s.disc2], [true, true], 'one spell in 3 minutes');
    assert.equal(s.sanc, 1600, '100 m'); assert.equal(s.saved, true); assert.ok(s.inv > 5); assert.equal(s.immune, true);
    assert.equal(s.back, true, 'kept in the save'); assert.equal(s.cdHold, true, 'two and a half hours'); assert.equal(s.join, 3200, 'joined: 200 m'); assert.equal(s.broke, true, 'a step breaks it and gives the cooldown back');
    // Holy Weapon: +500 divine damage a hit, more on the undead (v3.18, ch 495)
    const hw = await g.eval(() => { const G = window.__G, P = G.P; for (const q of G.mons()) { q.dead = true; q.rt = 1e9; }
      const w = G.spawnMon('wolf', P.x + 30, P.y), k = G.spawnMon('skel', P.x + 30, P.y); for (const m of [w, k]) { m.max = m.hp = 1e9; m.lv = 1; }
      const one = (m) => { const h = m.hp; window.__GU.hitMon(m, 0.0001, { pure: 1 }); return h - m.hp; };
      const tick = (m) => { const h = m.hp; window.__GU.hitMon(m, 0.0001, { dot: 1 }); return h - m.hp; };
      P.shwU = 0; const a = one(w), b = one(k), e0 = tick(w); P.shwU = 1e12; const c = one(w), d = one(k), e1 = tick(w); P.shwU = 0; return [c - a, d - b, e1 - e0, Math.round(500 * (1 - window.__GEL.res('skel', 'holy')))]; });
    assert.ok(Math.abs(hw[0] - 500) <= 1 && Math.abs(hw[1] - hw[3]) <= 1, 'Holy Weapon: +500, the undead take more (their holy weakness): ' + hw); assert.ok(Math.abs(hw[2]) <= 1, 'not on a tick: ' + hw[2]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
