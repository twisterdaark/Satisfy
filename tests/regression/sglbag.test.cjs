'use strict';
// The reputation store's sunglasses come off and on from the bag (owner 2026-10-22: "a way to take them off without
// opening the reputation store").
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the sunglasses show in the bag and a click takes them off and puts them on', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    assert.equal(await g.eval(() => window.__G.bag().INVS.some((s) => s.k === 'sgl')), false);
    await g.eval(() => { window.__G.S.rsh = { c: 0, g: 1, w: 1, d: 0 }; });
    await g.page.keyboard.press('KeyI');
    const click = () => g.eval(() => { const B = window.__G.bag(); B.invClick(B.INVS.findIndex((s) => s.k === 'sgl')); return window.__G.S.rsh.w; });
    assert.equal(await click(), 0, 'off');
    assert.equal(await click(), 1, 'and on again');
    assert.equal(await g.eval(() => window.__G.bag().INVS.filter((s) => s.k === 'sgl').length), 1);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
