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
    // no bald spot: the hairline row never shows a one- or two-pixel gap of skin with hair above and on both sides
    const holes = await g.eval(() => {
      const X = window.__GLOOK, out = [];
      for (const fem of [1, 0]) for (let i = 0; i < X.LOOK.hair.length; i++) for (const d of ['d', 's']) {
        const n = X.LOOK.hair[i]; if (n === 'slick') continue;   // the widow's peak leaves the temples bare on purpose
        const c = X.fig({ g: fem, hair: i, hc: 6, skin: 0, top: 1 }, 0), sk = SatArt.chars.frame({ ...c, hc: '#00ff00', hl: '#00ff00', hfx: 0, tie: 0 }, d, 'idle', 0).c.getContext('2d').getImageData(0, 0, 16, 24).data;
        const isH = (x, y) => { const k = (y * 16 + x) * 4; return x >= 0 && x < 16 && sk[k + 1] > 150 && sk[k] < 60 && sk[k + 2] < 60; };
        const isS = (x, y) => sk[(y * 16 + x) * 4 + 3] > 0 && !isH(x, y);
        const y = 6;   // the frame row of the fringe (head row 4)
        for (let x = 5; x < 12; x++) if (isS(x, y) && isH(x, y - 1)) { let l = x, r = x; while (isS(l - 1, y)) l--; while (isS(r + 1, y)) r++; if (r - l <= 1 && isH(l - 1, y) && isH(r + 1, y)) out.push((fem ? 'F ' : 'M ') + n + ' ' + d + ' ' + x); }
      }
      return [...new Set(out)];
    });
    assert.deepEqual(holes, []);
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
