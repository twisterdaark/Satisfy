'use strict';
// SAT-ONLINE-109 (plan U186): boss fight replays. A fight with a boss near you is recorded twice a second (the boss, you
// and your party near you, its start and how it ended) with nothing of anyone's bag, gold or items. It stays on this
// device under L; a replay plays it back as ghosts where it happened at double speed, the view following the boss, and
// you can't be hurt while you watch; Escape stops it.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('boss fight replays: recorded with no private data, kept under L, watched as ghosts in safety', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    // a boss, the player beside it, unhurt; the fight starts when it is hurt and goes for 4 s
    const k = await g.eval(() => { const G = window.__G, P = G.P; const m = window.__RREP.boss(); P.x = m.x - 40; P.y = m.y; P.inv = 1e9; window.__bm = m; m.hp = Math.round(m.max * 0.8); return m.type; });
    await g.step(30);
    assert.ok(await g.eval(() => !!window.__RREP.rec), 'recording');
    await g.step(200);
    await g.eval(() => { const m = window.__bm; m.hp = 0; window.__RREP.kill(m); });
    await g.step(5);
    const logs = await g.eval(() => window.__RREP.logs());
    assert.equal(logs.length, 1);
    const L = logs[0];
    assert.equal(L.k, k);
    assert.equal(L.res, 'kill');
    assert.ok(L.s.length >= 8, 'twice a second: ' + L.s.length);
    assert.deepEqual(L.ev.map((e) => e[0]), ['start', 'kill']);
    assert.equal(L.s[0][4][0][0], 'me', 'you, with your name and health');
    assert.ok(!/gold|items|mats|bag|"it"|iid/.test(JSON.stringify(L)), 'nothing of the bag, gold or items');
    assert.ok(await g.eval(() => !!localStorage.getItem('satisfy_raidlogs')), 'kept on the device');

    // under L: the fight, then the replay
    await g.page.keyboard.press('KeyL'); await g.step(2);
    const row = await g.eval(() => { const b = document.querySelector('#logL [data-rr="0"]'); return b && b.textContent; });
    assert.match(row, /^▶ .+ · killed · 0:0\d$/);
    // walk away first: the view goes where the fight was
    await g.eval(() => document.querySelector('#logL [data-rr="0"]').click()); await g.step(2);
    await g.eval(() => { window.__G.P.x -= 2000; });
    await g.step(10);
    assert.ok(await g.eval(() => !!window.__RREP.play), 'watching');
    assert.equal(await g.mode(), 'play');
    assert.ok(await g.eval(() => window.__G.P.inv > 1e8), "can't be hurt while watching");
    assert.match(await g.eval(() => document.getElementById('rrL').textContent), /^▶ .+ \d:\d\d \/ 0:0\d$/);
    // the view follows the boss's ghost, not you
    // Escape stops it; safe no more
    await g.page.keyboard.press('Escape'); await g.step(2);
    assert.equal(await g.eval(() => window.__RREP.play), null);
    assert.ok(await g.eval(() => window.__G.P.inv < 10));
    assert.equal(await g.mode(), 'play', 'Escape stopped the replay only, no pause');
    // played to its end it stops by itself
    await g.eval(() => window.__RREP.playI(0)); await g.step(5);
    for (let i = 0; i < 20 && await g.eval(() => !!window.__RREP.play); i++) await g.step(30);
    assert.equal(await g.eval(() => window.__RREP.play), null, 'over');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
