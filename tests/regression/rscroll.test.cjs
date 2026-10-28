'use strict';
// Owner 2026-10-23: Return Scrolls take you straight back to town; dear at the inns, and Sticks gives one now and then.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('a Return Scroll takes you to your inn after a moment; a hit breaks it; inns sell it dear; once a minute', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, X = window.__GRT, o = {};
      S.gold = 20000; const op = X.opt('inn')[0]; o.price = S.gold; op.f(); o.price -= S.gold; o.have = S.mats.rscroll;
      S.mats.rscroll = 3; S.bind = 'inn'; const inn = G.npcs.find((n) => n.id === 'inn'); o.inn = [inn.x, inn.y + 18];
      P.x = 300 * 16; P.y = 120 * 16; o.start = [P.x, P.y]; X.use(); o.casting = !!P.rcast; return o; });
    assert.ok(r.price >= 5000, 'dear: ' + r.price); assert.equal(r.have, 1);
    assert.ok(r.casting, 'it starts reading');
    await g.step(30);
    assert.deepEqual(await g.eval(() => [window.__G.P.x, window.__G.P.y]), r.start, 'not before the light finishes');
    await g.step(150);
    const p = await g.eval(() => ({ x: window.__G.P.x, y: window.__G.P.y, n: window.__G.S.mats.rscroll }));
    assert.deepEqual([p.x, p.y], r.inn, 'at the inn'); assert.equal(p.n, 2);
    // once a minute, and a hit breaks it
    const q = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, X = window.__GRT; X.use(); const cd = !P.rcast; S.rsT = 0; P.x = 300 * 16; P.y = 120 * 16; X.use(); const on = !!P.rcast; P.inv = 0; P.hp = 1e9; G.mons()[0] && 0; return { cd, on }; });
    assert.ok(q.cd, 'a minute between scrolls'); assert.ok(q.on);
    const broke = await g.eval(() => { const G = window.__G; G.P.inv = 0; G.P.dash = 0; window.__GC2.hurt(50, { x: G.P.x + 10, y: G.P.y }); return !G.P.rcast; });
    assert.ok(broke, 'a hit breaks the reading');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Sticks, once cured, has a scroll for you some days; you can ask once a day', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const G = window.__G, S = G.S, X = window.__GRT; S.bh = { st: 1 }; let got = 0, asks = 0;
      const o = X.sticks(); const before = S.mats.rscroll || 0; o[0].f(); asks++; const after1 = S.mats.rscroll || 0; o[0].f(); const after2 = S.mats.rscroll || 0;
      let n = 0; for (let i = 0; i < 200; i++) { S.bh.rsd = 0; const b = S.mats.rscroll || 0; X.sticks()[0].f(); if ((S.mats.rscroll || 0) > b) n++; }
      S.bh = {}; return { once: after2 === after1, n, none: X.sticks().length }; });
    assert.ok(r.once, 'once a day');
    assert.ok(r.n > 40 && r.n < 130, 'some days: ' + r.n);
    assert.equal(r.none, 0, 'not before he is cured');
  } finally { await g.close(); }
});
