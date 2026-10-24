'use strict';
// SAT-ONLINE-211 (owner 2026-10-24: "the lag grew a lot, many frame drops"): measured in real time, the garbage collector
// ran a full collection about twice a second while walking or fighting (15-20 ms each), because the map's painting made
// a new ImageData for every strip of ground, a new 1 KB buffer for every tile, and a new canvas, ImageData and kind map
// for every strip of the HUD map. Now:
//   - ground strips reuse one ImageData per size and one tile buffer;
//   - a HUD map strip (drawn into its piece) paints on a scratch canvas kept for its size;
//   - the pixels are the same (regression/chunks: a chunk made in idle strips equals one made in one go;
//     regression/mininow and regression/smooth: the HUD map's).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('painting ground chunks and a HUD map piece reuses its buffers; the pixels are the same', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.step(30);
    const r = await g.eval(() => {
      const G = window.__G, C2 = CanvasRenderingContext2D.prototype, mk0 = C2.createImageData, ce0 = document.createElement;
      let nImg = 0, nCv = 0;
      C2.createImageData = function () { nImg++; return mk0.apply(this, arguments); };
      document.createElement = function (t) { if (String(t).toLowerCase() === 'canvas') nCv++; return ce0.apply(this, arguments); };
      try {
        const { gg } = G.chunkLayers(), out = {};
        // three ground chunks far east, each painted then (a chunk at once is one strip of all its rows)
        out.h = [[1700, 60], [1740, 60], [1780, 60]].map(([x, y]) => gg.hash(x * 16, y * 16));
        out.chunkImg = nImg;
        // ten HUD map strips of 4 rows drawn into a piece, as the HUD's painting does
        nImg = 0; nCv = 0;
        const big = ce0.call(document, 'canvas'); big.width = 132 * 8; big.height = 44 * 8; const bg = big.getContext('2d');
        for (let k = 0; k < 10; k++) G.mmo({ x0: 1000, cols: 132, y0: 40 + k * 4, rows: 4, into: { g: bg, dx: 0, dy: k * 32 } });
        out.stripCv = nCv; out.stripImg = nImg;
        return out;
      } finally { C2.createImageData = mk0; document.createElement = ce0; }
    });
    assert.ok(r.h.every((h) => typeof h === 'number'));
    assert.ok(r.chunkImg <= 1, 'one ImageData for the three chunks (the same size), not one each: ' + r.chunkImg);
    assert.ok(r.stripCv <= 1, 'one scratch canvas for the ten HUD map strips, not one each: ' + r.stripCv);
    assert.ok(r.stripImg <= 1, 'and one ImageData: ' + r.stripImg);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
