'use strict';
// No blur behind the windows (SAT-ONLINE-195; owner 2026-10-24: "the lag grew a lot, many frame drops, many things freeze
// the game"). A backdrop-filter behind a window is painted again every frame the world behind it moves; with the bag,
// the status, the map, the Monster Book, a dialog or the menu open, nothing on the page blurs what is behind it.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const blurred = (g) => g.eval(() => [...document.querySelectorAll('*')].filter((e) => { const f = getComputedStyle(e).backdropFilter; return f && f !== 'none'; }).map((e) => e.id || e.className || e.tagName));

test('no window blurs the world behind it', async () => {
  const g = await H.openGame({});
  try {
    assert.deepEqual(await blurred(g), [], 'on the title screen');
    await H.newGame(g);
    assert.deepEqual(await blurred(g), [], 'in play');
    for (const [k, mode] of [['i', 'inv'], ['c', 'status'], ['m', 'map'], ['b', 'mb'], ['Escape', 'pause']]) {
      await g.page.keyboard.press(k); await g.step(3);
      assert.equal(await g.mode(), mode, 'opened with ' + k);
      assert.deepEqual(await blurred(g), [], 'with ' + mode + ' open');
      await g.page.keyboard.press(k === 'Escape' ? 'Escape' : k); await g.step(3);
    }
    await g.eval(() => window.__G.talkNPC('merchant')); await g.step(3);
    assert.equal(await g.eval(() => !document.getElementById('dialog').hidden), true);
    assert.deepEqual(await blurred(g), [], 'with a dialog open');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
