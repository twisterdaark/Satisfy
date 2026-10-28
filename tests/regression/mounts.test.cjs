'use strict';
// Three new mounts from the Stable Master in Reidan (the player Soki through the owner 2026-10-26): the Pegasus flies over water,
// the Ember Steed burns the foes it runs past, the Unicorn gives +5% to every stat.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('Pegasus over water, Ember Steed burns, Unicorn blesses', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const a = await g.eval(() => { const S = window.__G.S, M = window.__GMNT; S.lv = 300;
      const n = M.npc(); M.give('pegasus'); const rode = M.ride(); return { n, rode, fly: M.fly(), w: M.water() }; });
    assert.deepEqual(a.n && [a.n.solid, a.n.reid], [false, true], JSON.stringify(a.n));
    assert.equal(a.rode, true); assert.equal(a.fly, true);
    assert.deepEqual(a.w, [true, false], 'water stops a rider but not the Pegasus');
    const b = await g.eval(() => { const M = window.__GMNT; M.off(); const s0 = M.stat('str'); M.give('unicorn'); M.ride(); return { s0 }; });
    await g.step(40);
    const c = await g.eval(() => { const M = window.__GMNT; return { uni: M.uni(), s1: M.stat('str') }; });
    assert.equal(c.uni, 1.05); assert.ok(c.s1 > b.s0, JSON.stringify([b, c]));
    const i = await g.eval(() => { const M = window.__GMNT; M.off(); M.give('ember'); M.ride(); const i = M.near(); return { i, hp: i >= 0 ? M.mhp(i) : 0 }; });
    assert.ok(i.i >= 0);
    for (let k = 0; k < 12; k++) { await g.eval(() => window.__GMNT.jig()); await g.step(5); }
    const hp = await g.eval((j) => window.__GMNT.mhp(j), i.i);
    assert.ok(hp < i.hp, `the Ember Steed burns: ${i.hp} -> ${hp}`);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
