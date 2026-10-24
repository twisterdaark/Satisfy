'use strict';
// Owner 2026-10-21 (Oppo Reno 13F): on an Android phone held sideways the address bar stayed and the game sat in a
// smaller box. A real tap asks for full screen; the title and pause menus keep a Full screen button while it is off.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

// a 20:9 phone sideways, with the browser's bars taking part of the height
const PHONE = { viewport: { width: 915, height: 330 }, screen: { width: 915, height: 412 }, isMobile: true, hasTouch: true };

test('a tap on a phone goes full screen, and the menu button shows only while it is off', async () => {
  const ctx = await H.newContext({ device: PHONE });
  const g = await H.openGame({ ctx });
  try {
    assert.equal(await g.eval(() => window.__G.mode), 'title');
    assert.equal(await g.eval(() => !!document.fullscreenElement), false);
    assert.equal(await g.eval(() => document.querySelector('#titleScreen .fsBtn').hidden), false, 'the title shows Full screen');
    assert.equal(await g.eval(() => document.querySelector('#titleScreen .fsBtn').textContent), 'Full screen');
    const box = await g.eval(() => { const r = document.querySelector('#titleScreen .fsBtn').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await g.page.touchscreen.tap(box[0], box[1]);
    await g.page.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 5000 });
    await g.step(4);
    assert.equal(await g.eval(() => document.querySelector('#titleScreen .fsBtn').hidden), true, 'the button goes once full screen');
    await g.eval(() => document.exitFullscreen());
    await g.page.waitForFunction(() => !document.fullscreenElement, null, { timeout: 5000 });
    await g.step(2);
    assert.equal(await g.eval(() => document.querySelector('#titleScreen .fsBtn').hidden), false, 'and comes back when it is left');
    await g.page.touchscreen.tap(30, 30); // any tap on the game asks again
    await g.page.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 5000 });
  } finally { await g.close(); }
});

test('a computer never sees the button', async () => {
  const g = await H.openGame();
  try {
    await g.step(2);
    assert.equal(await g.eval(() => [...document.querySelectorAll('.fsBtn')].every((b) => b.hidden)), true);
  } finally { await g.close(); }
});

test('on a phone the pause menu also opens Arrange buttons; a computer does not show it', async () => {
  const ctx = await H.newContext({ device: PHONE });
  const g = await H.openGame({ ctx });
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.eval(() => { window.__G.mode = 'pause'; document.getElementById('settingsScreen').hidden = false; });
    const b = await g.eval(() => { const e = document.querySelector('#settingsScreen [data-act="tLay"]'); return [e.offsetParent !== null, e.textContent]; });
    assert.deepEqual(b, [true, 'Arrange buttons']);
    await g.eval(() => document.querySelector('#settingsScreen [data-act="tLay"]').click());
    await g.step(2);
    assert.equal(await g.eval(() => window.__G.mode), 'play');
    assert.equal(await g.eval(() => document.body.classList.contains('tLay')), true, 'the arrange mode is on');
  } finally { await g.close(); }
  const pc = await H.openGame();
  try {
    assert.equal(await pc.eval(() => document.querySelector('#settingsScreen [data-act="tLay"]').offsetParent), null);
  } finally { await pc.close(); }
});
