'use strict';
// Owner 2026-10-21 (a black screen on phones): start-up no longer paints the whole 8 px world map (27 million pixels) or
// every figure's sheet. The map is painted in windows that must join exactly; a loading screen shows until the first frame.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the loading screen goes with the first frame; sheets and the HUD map come when needed', async () => {
  const g = await H.openGame();
  try {
    assert.equal(await g.eval(() => document.getElementById('boot')), null);
    const r = await g.eval(() => {
      const G = window.__G, a = G.mmo({ x0: 100, y0: 150, cols: 40, rows: 30 }), b = G.mmo({ x0: 90, y0: 140, cols: 60, rows: 50 });
      const pa = a.getContext('2d').getImageData(0, 0, 320, 240).data, pb = b.getContext('2d').getImageData(80, 80, 320, 240).data;
      let diff = 0; for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) diff++;
      const m = G.mapBase(), t = G.baseTile(0, 1);
      return { w: [a.width, a.height], diff, left: G.miniLeft(), mini: [m.width, m.height], tile: [t.width, t.height] };
    });
    assert.deepEqual(r.w, [320, 240]);
    assert.equal(r.diff, 0, 'two windows over the same land paint the same pixels');
    assert.equal(r.left, 0, 'asking for the HUD map finishes it');
    assert.deepEqual(r.tile, [1024, 1024]);
    await g.page.keyboard.press('KeyM'); await g.step(3); // the world map draws from the pieces
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
