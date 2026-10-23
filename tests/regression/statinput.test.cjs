'use strict';
// A player 2026-10-23: "add a custom input for skill points, it's super annoying doing 5 at a time". A box by the points:
// type how many, then + by a stat puts that many in (capped at what you have); empty, + puts one in as before.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./../harness/game.cjs');
test.after(() => H.closeBrowser());

test('stat points: type how many, + by a stat puts them in, capped at what you have', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.eval(() => { window.__G.S.pts = 150; });
    await g.page.keyboard.press('KeyC');
    await g.step(2);
    const st = () => g.eval(() => ({ ...window.__G.S.st, pts: window.__G.S.pts }));
    const s0 = await st();
    await g.page.fill('#stAmt', '100');
    await g.page.click('button[data-stat="str"]:not([data-n])');
    let s = await st();
    assert.deepEqual([s.str - s0.str, s.pts], [100, 50], '100 into strength in one press');
    assert.equal(await g.page.inputValue('#stAmt'), '100', 'the amount stays for the next stat');
    await g.page.click('button[data-stat="agi"]:not([data-n])');
    s = await st();
    assert.deepEqual([s.agi - s0.agi, s.pts], [50, 0], 'more than you have puts the rest in');
    await g.eval(() => { window.__G.S.pts = 10; });
    await g.page.keyboard.press('KeyC'); await g.step(1); await g.page.keyboard.press('KeyC'); await g.step(2);
    await g.page.fill('#stAmt', '');
    await g.page.click('button[data-stat="dex"]:not([data-n])');
    s = await st();
    assert.deepEqual([s.dex - s0.dex, s.pts], [1, 9], 'empty: one point as before');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
