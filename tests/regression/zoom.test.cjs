'use strict';
// SAT-ONLINE-118 (plan U322, "UI usable at 125% scaling"): the screens a player uses most, opened in windows the size a
// 1280x720 and a 1366x768 screen give at 125% (and a small window), at device scale 1.25. Every button, input and choice of
// the screen that is open is inside the window and is what a click at its centre lands on (nothing of the same screen
// on top of it).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

// the controls of the open screen (root: its element) that are outside the window or under something else of it
const problems = (g, root) => g.eval((id) => {
  const box = document.getElementById(id), W = innerWidth, Hh = innerHeight, out = [];
  if (!box) return ['no #' + id];
  for (const e of box.querySelectorAll('button,input,select,[data-act]')) {
    const r = e.getBoundingClientRect(), st = getComputedStyle(e);
    if (!(r.width > 0 && r.height > 0) || st.visibility === 'hidden') continue;
    const name = e.id || e.dataset.act || e.textContent.trim().slice(0, 24) || e.tagName;
    if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > Hh + 1) { out.push('outside: ' + name + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round)); continue; }
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (at && at !== e && !e.contains(at) && !at.contains(e) && box.contains(at)) out.push('under ' + (at.id || at.className || at.tagName) + ': ' + name);
  }
  return out;
}, root);
async function open(g, key, id) {
  await g.page.keyboard.press(key); await g.step(3);
  const shown = await g.eval((i) => { const e = document.getElementById(i); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, id);
  assert.ok(shown, key + ' opens #' + id);
}

for (const [w, h] of [[1024, 576], [1093, 614], [800, 450]]) {
  test(`at 125%, ${w}x${h}: title, Esc menu, bag, status and a dialog fit and can be clicked`, async () => {
    const ctx = await H.newContext({ device: { viewport: { width: w, height: h }, deviceScaleFactor: 1.25 } });
    const g = await H.openGame({ ctx });
    try {
      assert.deepEqual(await problems(g, 'titleScreen'), [], 'title');
      await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
      await g.step(3);
      await open(g, 'Escape', 'pauseScreen');
      assert.deepEqual(await problems(g, 'pauseScreen'), [], 'Esc menu');
      await g.page.keyboard.press('Escape'); await g.step(3);
      await open(g, 'KeyI', 'inv');
      assert.deepEqual(await problems(g, 'inv'), [], 'bag');
      await g.page.keyboard.press('KeyI'); await g.step(3);
      await open(g, 'KeyC', 'statusW');
      assert.deepEqual(await problems(g, 'statusW'), [], 'status');
      await g.page.keyboard.press('KeyC'); await g.step(3);
      await open(g, 'KeyG', 'dialog');
      assert.deepEqual(await problems(g, 'dialog'), [], 'a dialog with choices');
      assert.deepEqual(g.errors, []);
    } finally { await ctx.close(); }
  });
}
