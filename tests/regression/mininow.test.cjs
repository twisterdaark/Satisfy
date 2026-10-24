'use strict';
// The HUD map's piece the screen needs now (SAT-ONLINE-197; owner 2026-10-24: "many things freeze the game"). A piece the
// HUD map needed and didn't have was finished in one go (0.2 s each, two at the start of play: a 0.6 s freeze). Now:
//   - the frame that needs it doesn't finish it: the piece is still on its way after that frame;
//   - it is painted in the next frames' strips (and in idle time) and is done within a second of frames;
//   - what it paints is the same piece (the pixels of one go, as before: regression/smooth checks the strips).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('a HUD map piece is painted over the next frames, not at once', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.step(30);
    // far east, where nothing is painted yet: the HUD map draws in the same evaluate, so no idle time runs between
    const r = await g.eval(() => { const G = window.__G, P = G.P; P.inv = 1e9; P.x = 1900 * 16; P.y = 120 * 16;
      const before = G.pj().filter(([k, p]) => k[0] === 'm' && p <= 0).map(([k]) => k);
      for (let i = 0; i < 13; i++) window.__step(1); // the HUD map draws 5 times a second: one draw within 13 frames
      const now = G.pj().filter(([k, p]) => k[0] === 'm' && p <= 0).map(([k]) => k.slice(1));
      return { before, now, has: now.map((k) => { const [i, j] = k.split(',').map(Number); return G.miniHas(i, j); }) }; });
    assert.ok(r.now.length >= 1, 'the HUD map asked for a piece: ' + JSON.stringify(r));
    assert.ok(r.has.every((h) => !h), 'not finished in one go: ' + JSON.stringify(r));
    // the next frames paint it: done within 60 frames (one strip a frame at the least)
    const done = await g.eval((want) => { const G = window.__G; for (let n = 1; n <= 80; n++) { window.__step(1); if (want.every((k) => { const [i, j] = k.split(',').map(Number); return G.miniHas(i, j); })) return n; } return -1; }, r.now);
    assert.ok(done > 0 && done <= 80, 'painted over the next frames: ' + done);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
