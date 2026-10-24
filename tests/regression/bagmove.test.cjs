'use strict';
// owner 2026-10-22: the bag window moves by its title bar and opens where you left it.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('drag the bag by its title; it stays there when opened again', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.page.keyboard.press('KeyI'); await g.step(3); await g.page.waitForTimeout(400);
    const r0 = await g.eval(() => { const r = document.getElementById('invH').getBoundingClientRect(); const b = document.getElementById('inv').getBoundingClientRect(); return { hx: r.left + 4, hy: r.top + r.height / 2, x: b.left, y: b.top }; });
    await g.page.mouse.move(r0.hx, r0.hy); await g.page.mouse.down(); await g.page.mouse.move(r0.hx - 150, r0.hy + 60, { steps: 6 }); await g.page.mouse.up();
    const r1 = await g.eval(() => { const b = document.getElementById('inv').getBoundingClientRect(); return { x: b.left, y: b.top }; });
    assert.ok(Math.abs(r1.x - (r0.x - 150)) < 3 && Math.abs(r1.y - (r0.y + 60)) < 3, JSON.stringify([r0, r1]));
    assert.equal(await g.eval(() => window.__G.mode), 'inv', 'still open');
    await g.page.keyboard.press('KeyI'); await g.step(3); await g.page.keyboard.press('KeyI'); await g.step(3);
    // its opening animation (pin, .25 s on real time) has ended: a busy moment can start it a little late
    await g.page.waitForFunction(() => document.getElementById('inv').getAnimations().every((a) => a.playState === 'finished'), null, { timeout: 3000 }).catch(() => {}); await g.page.waitForTimeout(50);
    const r2 = await g.eval(() => { const b = document.getElementById('inv').getBoundingClientRect(); return { x: b.left, y: b.top }; });
    assert.ok(Math.abs(r2.x - r1.x) < 3 && Math.abs(r2.y - r1.y) < 3, 'opens where it was left: ' + JSON.stringify([r1, r2]));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
