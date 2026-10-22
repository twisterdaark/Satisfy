'use strict';
// Instances start clean (owner 2026-10-22: "if you enter the tournament and then the tower, the one you fought in the
// tournament stays there along with the monsters"): the daily arena, the trial tower, the Tower of Wisdom and the
// competition grounds share the space under the world; entering one sweeps out what another left.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the arena opponent never follows into a tower', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.eval(() => { window.__G.S.lv = 100; });
    await g.step(3);
    const arena = () => g.eval(() => window.__GTRK.mons().filter((m) => m.arena && !m.dead).length);
    await g.eval(() => window.__GTW.arena()); await g.page.waitForTimeout(600); await g.step(60 * 4);
    assert.equal(await arena(), 1, 'the opponent is in the arena');
    // straight into the Tower of Wisdom: the opponent is swept
    await g.eval(() => window.__GTW.enter('f1')); await g.page.waitForTimeout(600); await g.step(30);
    assert.equal(await g.eval(() => window.__GTRK.mons().filter((m) => m.arena).length), 0);
    await g.eval(() => window.__GTW.leave()); await g.page.waitForTimeout(700); await g.step(30);
    // lose in the arena, then the trial tower: nothing from the arena in it
    await g.eval(() => { window.__GTW.ARN && (window.__GTW.ARN.wait = 0); }); await g.step(5);
    await g.eval(() => { window.__G.P.hp = 0; window.__G.die && window.__G.die(); });
    await g.page.waitForTimeout(1600); await g.step(30);
    await g.eval(() => window.__GTW.trial(1)); await g.page.waitForTimeout(600); await g.step(60 * 4);
    const r = await g.eval(() => window.__GTRK.mons().filter((m) => !m.dead).map((m) => (m.arena ? 'A' : '') + (m.tower ? 'T' : '')).filter(Boolean));
    assert.ok(!r.includes('A'), 'no arena opponent: ' + r.join(','));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
