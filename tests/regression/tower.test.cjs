'use strict';
// The Tower of Wisdom (major #5): its gate stands at this week's hidden site, every floor can be entered and stood on
// (wood floors, not grass), and leaving puts you back outside, with no page errors.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('every floor of the tower can be entered, stood on and left', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const gate = await g.eval(() => { const s = window.__GTW.spot(); return { x: s.x, y: s.y, tw: s.tw }; });
    assert.equal(gate.tw, 'enter');
    const floors = await g.eval(() => window.__GTW.floors());
    for (const f of floors) {
      await g.eval((f) => { window.__G.S.lv = 400; window.__GTW.enter(f, 'up'); }, f);
      await g.page.waitForTimeout(900); await g.step(20); // the fade runs on real time
      const r = await g.eval(() => ({ f: window.__GTW.T && window.__GTW.T.f, tile: window.__GTW.tile(), y: window.__G.P.y, mode: window.__G.mode }));
      assert.equal(r.f, f, 'on ' + f);
      assert.ok([0, 1, 2, 5, 9, 10, 12].includes(r.tile), f + ' stands on open ground, tile ' + r.tile);
      if (f !== 'f1') assert.ok(r.tile !== 0 && r.tile !== 1, f + ' has a floor, not grass (tile ' + r.tile + ')'); // 1F is the plain
      await g.eval(() => { if (window.__G.mode === 'dialog') window.__G.act('dlgNext'); });
    }
    await g.eval(() => window.__GTW.leave());
    await g.page.waitForTimeout(900); await g.step(20);
    const out = await g.eval(() => ({ tow: window.__GTW.T, y: window.__G.P.y }));
    assert.equal(out.tow, null);
    assert.ok(out.y < 272 * 16, 'back in the open world');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
