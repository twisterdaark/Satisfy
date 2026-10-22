'use strict';
// "A legend doesn't die easily" (owner 2026-10-22): every legendary class, on a blow that would kill, stays at 1 HP and
// takes no harm for 3 seconds, then once more only after the cooldown; other classes die as before.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('a legendary class survives a killing blow at 1 HP, untouched for 3 seconds; a warrior does not', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const a = await g.eval(() => { const G = window.__G, S = G.S, P = G.P; S.cls = 'pagma'; S.immT = 0; P.inv = 0; P.dash = 0;
      window.__GWP.hurt(1e9); const h1 = P.hp, m1 = G.mode; window.__GWP.hurt(1e9); return { h1, m1, h2: P.hp, m2: G.mode, inv: P.inv, cd: S.immT }; });
    assert.equal(a.h1, 1); assert.equal(a.m1, 'play');
    assert.equal(a.h2, 1, 'no harm while it lasts'); assert.equal(a.m2, 'play');
    assert.ok(a.inv > 2.9 && a.inv <= 3, String(a.inv)); assert.equal(a.cd, 120);
    for (let i = 0; i < 4; i++) await g.step(60);
    const b = await g.eval(() => { const G = window.__G, P = G.P; P.dash = 0; const inv = P.inv, im = G.S.immT; window.__GWP.hurt(1e9); return { hp: P.hp, mode: G.mode, inv, im }; });
    assert.equal(b.mode, 'dead', 'the cooldown has not run out: ' + JSON.stringify(b));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a warrior dies to a killing blow; the passive shows in a legend\'s status window', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const st = await g.eval(() => { const G = window.__G; G.S.cls = 'pagma'; G.S.immT = 0; window.__GTC.openStatus(); const x = document.getElementById('statusW').innerText; return x; });
    assert.match(st, /A Legend Does Not Die/);
    await g.eval(() => window.__G.act('closeStatus'));
    assert.equal(await g.eval(() => { const G = window.__G; G.S.cls = 'warrior'; G.S.immT = 0; G.P.inv = 0; G.P.dash = 0; window.__GWP.hurt(1e9); return G.mode; }), 'dead');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
