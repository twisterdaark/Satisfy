'use strict';
// owner 2026-10-23: "add a way back to the underground vampire city you already finished, instead of going down floor by floor"
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the ant hill offers the cleared cities and the next one; a lit return stone in a cleared city takes you up or across', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const opts = () => g.eval(() => [...document.querySelectorAll('#dopts button')].map((b) => b.textContent));
    await g.eval(() => { const S = window.__G.S; S.lv = 300; S.vc = { c: { 15: 1, 14: 1 } }; });
    assert.equal(await g.eval(() => window.__GVC.next()), 13);
    await g.eval(() => window.__GVC.menu(null)); await g.step(2);
    let o = await opts();
    assert.ok(o.some((x) => /City 15 \(cleared\)/.test(x)) && o.some((x) => /City 14 \(cleared\)/.test(x)) && o.some((x) => /City 13 \(next/.test(x)), JSON.stringify(o));
    assert.ok(!o.some((x) => /City 12/.test(x)), 'a city two ahead is not offered');
    await g.eval(() => { const b = [...document.querySelectorAll('#dopts button')].find((e) => /City 14/.test(e.textContent)); b.click(); });
    await g.eval(() => new Promise((r) => setTimeout(r, 450))); await g.step(2);
    assert.equal(await g.eval(() => { const P = window.__G.P, C = window.__GVC.at(P.x / 16, P.y / 16); return C && C.n; }), 14);
    await g.eval(() => window.__GVC.menu(14)); await g.step(2);
    o = await opts();
    assert.ok(/surface/.test(o[0]) && o.some((x) => /City 15/.test(x)) && !o.some((x) => /City 14/.test(x)), JSON.stringify(o));
    await g.eval(() => { document.querySelector('#dopts button').click(); });
    await g.eval(() => new Promise((r) => setTimeout(r, 450))); await g.step(2);
    const up = await g.eval(() => { const P = window.__G.P, A = window.__GVC.ant; return [window.__GVC.at(P.x / 16, P.y / 16), Math.abs(P.x / 16 - A.x) < 2 && Math.abs(P.y / 16 - A.y) < 4]; });
    assert.deepEqual(up, [null, true]);
    // a stone in a city not cleared stays dark
    const dark = await g.eval(() => window.__GVC.gate({ vc: 13, vstone: 1 }));
    assert.equal(dark, false);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the cities go down to the 1st: the 7th opens on the 6th, each has its master, nothing below the 1st', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => { const V = window.__GVC, S = window.__G.S; S.lv = 500; S.vc = { c: { 15: 1, 14: 1, 13: 1, 12: 1, 11: 1, 10: 1, 9: 1, 8: 1, 7: 1 } };
      const ns = V.VC.map((C) => C.n), masters = {}; for (const o of V.VCMS) masters[o.n] = o.m.type;
      const down7 = V.gate({ vc: 7, vdown: 1 }), down1 = (S.vc.c[1] = 1, V.gate({ vc: 1, vdown: 1 }));
      const C6 = V.VC.find((C) => C.n === 6), at6 = V.at(C6.x0 + 5, C6.ym);
      return { ns, masters, down7, down1, at6: at6 && at6.n, next: (delete S.vc.c[1], V.next()) }; });
    assert.deepEqual(r.ns, [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    assert.equal(r.down7, true, 'the way down from the 7th opens once its master is dead');
    assert.equal(r.down1, false, 'nothing below the 1st');
    assert.equal(r.at6, 6);
    assert.equal(r.next, 6);
    for (const [n, k] of [[6, 'vb6'], [5, 'vb5'], [4, 'vb4'], [3, 'vb3'], [2, 'vmrose'], [1, 'vfenrir']]) assert.equal(r.masters[n], k);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
