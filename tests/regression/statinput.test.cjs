'use strict';
// SAT-ONLINE-166 (owner 2026-10-23 23:27): "the stat-points input box". By "Stat points" in the status window there is a box:
// the number typed in it is what each + puts in.
//   - typed 12, + on Strength puts in 12, and the + buttons say +12;
//   - more than you have puts in all you have;
//   - empty, 0, a minus number or not a number: + puts in 1, as before;
//   - typing digits in the box doesn't reach the game's keys (no skill from the number keys, the window stays open);
//   - +5 and Shift+click work as before.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const st = (g) => g.eval(() => { const S = window.__G.S; return { pts: S.pts, str: S.st.str, agi: S.st.agi, int: S.st.int, mode: window.__G.mode }; });
const BOX = '#statusW .ptsIn', plus = (k) => `#statusW button.p1[data-stat="${k}"]`;

test('the stat-points box: each + puts in the typed number; more than you have puts in all; junk is 1 as before', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.eval(() => { window.__G.S.pts = 37; });
    await g.page.keyboard.press('c'); await g.step(3);
    const s0 = await st(g);
    assert.equal(s0.mode, 'status');
    assert.equal(await g.page.locator(BOX).count(), 1, 'one box, by "Stat points"');

    // 12, then + on Strength; typing digits doesn't use a skill or close the window
    await g.page.click(BOX);
    await g.page.keyboard.type('12'); await g.step(2);
    assert.equal(await g.page.inputValue(BOX), '12');
    assert.equal(await g.page.textContent(plus('str')), '+12', 'the + buttons say it');
    await g.page.click(plus('str')); await g.step(2);
    let s = await st(g);
    assert.deepEqual([s.pts, s.str - s0.str, s.mode], [25, 12, 'status']);
    assert.equal(await g.page.inputValue(BOX), '12', 'the box keeps it');
    await g.page.click(plus('int')); await g.step(2);
    s = await st(g);
    assert.deepEqual([s.pts, s.int - s0.int], [13, 12]);

    // more than you have: all you have
    await g.page.fill(BOX, '99'); await g.step(1);
    assert.equal(await g.page.textContent(plus('agi')), '+13', 'at most what you have');
    await g.page.click(plus('agi')); await g.step(2);
    s = await st(g);
    assert.deepEqual([s.pts, s.agi - s0.agi], [0, 13]);
    assert.equal(await g.page.locator(BOX).count(), 0, 'no points left: no box');

    // empty, 0, a minus number, not a number: 1 a click, as before
    for (const v of ['', '0', '-4', 'abc']) {
      await g.eval(() => { window.__G.S.pts = 3; });
      await g.page.keyboard.press('Escape'); await g.step(2); await g.page.keyboard.press('c'); await g.step(3);
      if (v === 'abc') await g.page.evaluate((sel) => { const f = document.querySelector(sel); f.value = 'abc'; f.dispatchEvent(new Event('input', { bubbles: true })); }, BOX);
      else { await g.page.fill(BOX, v); await g.step(1); }
      const a = await st(g);
      await g.page.click(plus('str')); await g.step(2);
      const b = await st(g);
      assert.deepEqual([a.pts - b.pts, b.str - a.str], [1, 1], JSON.stringify(v) + ': 1 point');
    }

    // +5 and Shift+click as before
    await g.eval(() => { window.__G.S.pts = 9; });
    await g.page.keyboard.press('Escape'); await g.step(2); await g.page.keyboard.press('c'); await g.step(3);
    const c0 = await st(g);
    await g.page.click('#statusW button[data-stat="str"][data-n="5"]'); await g.step(2);
    let c = await st(g);
    assert.deepEqual([c.pts, c.str - c0.str], [4, 5], '+5');
    await g.page.click(plus('str'), { modifiers: ['Shift'] }); await g.step(2);
    c = await st(g);
    assert.deepEqual([c.pts, c.str - c0.str], [0, 9], 'Shift+click: all');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
