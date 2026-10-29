'use strict';
// Opening art (docs/art/OPENING_ART.md): the title's six parallax layers and the new-game intro's shots, loaded from the repository.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the title stacks the six parallax layers, each loaded from sprites-original/opening and drifting', async () => {
  const g = await H.openGame();
  try {
    assert.equal(await g.mode(), 'title');
    const L = await g.eval(() => [...document.querySelectorAll('#titleScreen .tsbg i')].map((e) => { const c = getComputedStyle(e); return [e.className, c.backgroundImage, c.animationName, c.imageRendering]; }));
    assert.deepEqual(L.map((l) => l[0]), ['sky', 'mtn', 'castle', 'trees', 'fog', 'front']);
    for (const [k, bg, an, ir] of L) {
      assert.match(bg, new RegExp('sprites-original/opening/ts_' + k + '\\.png'), k);
      assert.match(an, /tsDrift/, k);
      assert.equal(ir, 'pixelated', k);
    }
    const ok = await g.eval(() => Promise.all(['sky', 'front'].map((k) => new Promise((r) => { const i = new Image(); i.onload = () => r(i.naturalWidth); i.onerror = () => r(0); i.src = 'sprites-original/opening/ts_' + k + '.png'; }))));
    assert.deepEqual(ok, [960, 960]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the intro shows one shot per card: grid, gate with the walker, rumour; Continue advances, the last closes', async () => {
  const g = await H.openGame();
  try {
    await g.eval((L) => window.__G.newGame(L), H.DEFAULT_LOOK);
    await g.waitMode('cut');
    const st = () => g.eval(() => ({ on: [...document.querySelectorAll('#cardP .cs.on')].map((e) => e.classList[1]), pics: !document.getElementById('cardP').hidden, txt: document.getElementById('cardT').textContent }));
    let s = await st();
    assert.deepEqual([s.on, s.pics], [['grid'], true]);
    assert.match(s.txt, /two billion players/);
    await g.eval(() => window.__G.CARD('next'));
    await g.eval(() => window.__G.CARD('next')); // a doubled press (key + click) does not skip a shot
    s = await st();
    assert.deepEqual(s.on, ['gate']);
    assert.match(s.txt, /Grid logged in for the first time in Winston/);
    assert.equal(await g.eval(() => document.querySelectorAll('#cardP .gate .walker i').length), 2);
    await g.page.waitForTimeout(300);
    await g.eval(() => window.__G.CARD('next'));
    s = await st();
    assert.deepEqual(s.on, ['rumor']);
    assert.match(s.txt, /legendary class/);
    await g.page.waitForTimeout(3000);
    assert.deepEqual((await st()).on, ['legend']);
    await g.eval(() => window.__G.CARD('next'));
    await g.waitMode('play');
    assert.equal(await g.eval(() => document.getElementById('card').hidden), true);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Skip intro closes the whole intro from its first shot', async () => {
  const g = await H.openGame();
  try {
    await g.eval((L) => window.__G.newGame(L), H.DEFAULT_LOOK);
    await g.waitMode('cut');
    await g.eval(() => window.__G.CARD('skip'));
    await g.waitMode('play');
    assert.equal(await g.eval(() => document.getElementById('card').hidden), true);
    assert.deepEqual(await g.eval(() => document.querySelectorAll('#cardP .cs.on').length), 0);
  } finally { await g.close(); }
});
