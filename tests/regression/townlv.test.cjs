'use strict';
// Each town's recommended level (owner 2026-10-24, from a player's idea): shown under its name on the map and when you
// walk in, from the levels of the monsters around it.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('town recommended level: grows along the road and shows on the map', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g, { n: 'Grid', hair: 3, hc: 0, skin: 1, top: 1 });
    const r = await g.eval(() => { const T = window.__GTLV; return { win: T.lv('zWin'), pat: T.lv('zPat'), reid: T.lv('zReid'), rein: T.lv('zRein'), none: T.lv('zGrave') }; });
    assert.ok(r.win > 0 && r.win < r.pat && r.pat < r.rein && r.reid < r.rein, JSON.stringify(r));
    assert.equal(r.none, 0, 'only towns get one');
    await g.page.keyboard.press('m'); await g.step(3);
    assert.equal(await g.eval(() => window.__G.mode), 'map');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
