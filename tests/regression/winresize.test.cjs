'use strict';
// Owner 2026-10-24: every window can be made smaller or bigger. A grip in the corner sizes it; the size is kept; a double click
// on the grip gives it its own size back.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./../harness/game.cjs');
test.after(() => H.closeBrowser());

test('windows: a corner grip resizes, the size stays after closing, a double click resets', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    for (const k of ['KeyI', 'KeyC', 'KeyU', 'KeyL', 'KeyM']) {
      await g.page.keyboard.press(k); await g.step(3);
      const has = await g.eval(() => [...document.querySelectorAll('.panel')].filter((p) => !p.hidden && p.querySelector(':scope>.prez')).length);
      assert.ok(has >= 1, 'a grip on the window opened by ' + k);
      await g.page.keyboard.press('Escape'); await g.step(3);
    }
    await g.page.keyboard.press('KeyI'); await g.step(3); await g.page.waitForTimeout(450);
    const r0 = await g.eval(() => { const r = document.getElementById('inv').getBoundingClientRect(); return [r.width, r.height]; });
    const gp = await g.eval(() => { const r = document.querySelector('#inv>.prez').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await g.page.mouse.move(gp[0], gp[1]); await g.page.mouse.down(); await g.page.mouse.move(gp[0] - 120, gp[1] - 80, { steps: 5 }); await g.page.mouse.up(); await g.step(2);
    const r1 = await g.eval(() => { const r = document.getElementById('inv').getBoundingClientRect(); return [r.width, r.height]; });
    assert.ok(r1[0] < r0[0] - 60 && r1[1] < r0[1] - 40, 'smaller: ' + r0 + ' -> ' + r1);
    await g.page.keyboard.press('Escape'); await g.step(3); await g.page.keyboard.press('KeyI'); await g.step(4); await g.page.waitForTimeout(450);   // the window's opening pop
    const r2 = await g.eval(() => { const r = document.getElementById('inv').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
    assert.ok(Math.abs(r2[0] - r1[0]) < 3 && Math.abs(r2[1] - r1[1]) < 3, 'kept: ' + r1 + ' / ' + r2);
    await g.page.mouse.dblclick(...(await g.eval(() => { const r = document.querySelector('#inv>.prez').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }))); await g.step(2);
    const r3 = await g.eval(() => { const r = document.getElementById('inv').getBoundingClientRect(); return [r.width, r.height]; });
    assert.ok(Math.abs(r3[0] - r0[0]) < 3, 'its own size again: ' + r0 + ' / ' + r3);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
