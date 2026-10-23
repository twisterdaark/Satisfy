'use strict';
// Every hairstyle looks clearly different (owner 2026-10-23): any two styles differ in at least 40 pixels across the
// front, back and side views, for boys and girls; the stylist's face and accessory choices zoom on the head.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('no two hairstyles are near copies, and the stylist grid zooms face choices', async () => {
  const g = await H.openGame();
  try {
    const r = await g.eval(() => {
      const X = window.__GLOOK, N = X.LOOK.hair.length, bad = [];
      for (const fem of [1, 0]) {
        const px = [];
        for (let i = 0; i < N; i++) px.push(['d', 'u', 's'].map(d => SatArt.chars.frame(X.fig({ g: fem, hair: i, hc: 2, skin: 0, top: 1 }, 0), d, 'idle', 0).c.getContext('2d').getImageData(0, 0, 16, 24).data));
        for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
          let n = 0;
          for (let v = 0; v < 3; v++) { const A = px[i][v], B = px[j][v]; for (let k = 0; k < A.length; k += 4) if (A[k] !== B[k] || A[k + 1] !== B[k + 1] || A[k + 2] !== B[k + 2] || A[k + 3] !== B[k + 3]) n++; }
          if (n < 40) bad.push((fem ? 'F ' : 'M ') + X.LOOK.hair[i] + '~' + X.LOOK.hair[j] + ' ' + n);
        }
      }
      return { N, bad };
    });
    assert.ok(r.N >= 70, 'hair count ' + r.N);
    assert.deepEqual(r.bad, []);
    await g.eval(() => window.__GLOOK.sty('acc'));
    await g.step(10);
    const c = await g.eval(() => [...document.querySelectorAll('#dopts canvas[data-lk]')].map(x => x.className));
    assert.ok(c.length >= 10 && c.every(x => x === 'zm'), c.join(','));
    await g.eval(() => window.__GLOOK.sty('hair'));
    await g.step(10);
    const h = await g.eval(() => [...document.querySelectorAll('#dopts canvas[data-lk]')].map(x => x.className + x.height));
    assert.ok(h.length >= 70 && h.every(x => x === 'hr20'), h.slice(0, 3).join(','));
  } finally { await g.close(); }
});
