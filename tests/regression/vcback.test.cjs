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
