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
    // the sanctuary forms after 3 s standing still and keeps her untouchable
    await g.eval(() => { const G = window.__G; G.P.mp = 1e6; window.__GSKF.cast('sasanc'); });
    await g.step(200);
    const s = await g.eval(() => ({ sanc: !!window.__GSA.sanc(), inv: window.__G.P.inv }));
    assert.equal(s.sanc, true); assert.ok(s.inv > 5, String(s.inv));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
