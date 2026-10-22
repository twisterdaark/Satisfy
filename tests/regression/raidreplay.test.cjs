'use strict';
// SAT-ONLINE-109 (plan U186): boss fight replays. A fight with a boss near you is recorded twice a second (the boss, you
// and your party near you, its start and how it ended) with nothing of anyone's bag, gold or items. It stays on this
// device under L; a replay plays it back as ghosts where it happened at double speed, the view following the boss. Watching
// is a spectator state (Claude-B's review of #143): you don't move, attack or use skills, any key or a click ends it, and so
// does being hit, so it never shields a fight.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('boss fight replays: recorded with no private data, kept under L, watched as ghosts by a spectator', async () => {
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
    assert.ok(L.s.every((x) => x[4].every((w) => w[0] === 'me' || /^p\d$/.test(w[0]))), 'the others by their place, no account ids');
    assert.ok(!/gold|items|mats|bag|"it"|iid/.test(JSON.stringify(L)), 'nothing of the bag, gold or items');
    assert.ok(await g.eval(() => !!localStorage.getItem('satisfy_raidlogs')), 'kept on the device');

    // under L: the fight, then the replay
    await g.page.keyboard.press('KeyL'); await g.step(2);
    const row = await g.eval(() => { const b = document.querySelector('#logL [data-rr="0"]'); return b && b.textContent; });
    assert.match(row, /^▶ .+ · killed · 0:0\d$/);
    // walk away first: the view goes where the fight was
    await g.eval(() => document.querySelector('#logL [data-rr="0"]').click()); await g.step(2);
    await g.eval(() => { window.__G.P.x -= 2000; window.__G.P.inv = 0; });
    await g.step(10);
    assert.ok(await g.eval(() => !!window.__RREP.play), 'watching');
    assert.equal(await g.mode(), 'rr', 'a spectator');
    assert.ok(await g.eval(() => !(window.__G.P.inv > 0)), 'no shield while watching');
    assert.match(await g.eval(() => document.getElementById('rrL').textContent), /^▶ .+ \d:\d\d \/ 0:0\d$/);
    // the view follows the boss's ghost, not you
    const view = await g.eval(() => { const R = window.__RREP.play, b = document.getElementById('stage').getBoundingClientRect(), p = window.__G.toScreen(R.cam.x, R.cam.y), me = window.__G.toScreen(window.__G.P.x, window.__G.P.y); return { dx: Math.abs(p.x - (b.left + b.width / 2)), dy: Math.abs(p.y - (b.top + b.height / 2)), me: Math.abs(me.x - (b.left + b.width / 2)), w: b.width }; });
    assert.ok(view.dx < view.w * 0.1 && view.dy < view.w * 0.1, 'the boss ghost in the middle: ' + JSON.stringify(view));
    assert.ok(view.me > view.w, 'you, far off screen');
    // no walking, no swings, no skills while watching
    const x0 = await g.eval(() => window.__G.P.x);
    await g.eval(() => { window.__RREP.K.right = true; }); await g.step(20); await g.eval(() => { window.__RREP.K.right = false; });
    assert.equal(await g.eval(() => window.__G.P.x), x0, "doesn't walk");
    assert.ok(await g.eval(() => !!window.__RREP.play));
    // any key ends it and does nothing else: Space would dodge
    await g.page.keyboard.press('Space'); await g.step(2);
    assert.equal(await g.eval(() => window.__RREP.play), null);
    assert.equal(await g.mode(), 'play', 'the key stopped the replay only, no pause');
    assert.ok(await g.eval(() => !(window.__G.P.dash > 0)), 'no dodge');
    // a click ends it, without a swing
    await g.eval(() => window.__RREP.playI(0)); await g.step(2);
    assert.equal(await g.mode(), 'rr');
    await g.eval(() => { window.__G.P.acd = 0; window.__G.P.slash = null; });
    const c = await g.eval(() => { const b = document.getElementById('stage').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }); // on the replay's view
    await g.page.mouse.click(c.x, c.y); await g.step(1);
    assert.equal(await g.eval(() => window.__RREP.play), null);
    assert.equal(await g.eval(() => window.__G.P.slash), null, 'no swing');
    // being hit ends it: no shield in a fight
    await g.eval(() => window.__RREP.playI(0)); await g.step(2);
    const hp0 = await g.eval(() => window.__G.P.hp);
    await g.eval(() => window.__RREP.hurt(5));
    assert.equal(await g.eval(() => window.__RREP.play), null, 'stopped by the hit');
    assert.ok(await g.eval((h) => window.__G.P.hp < h, hp0), 'and the hit lands');
    assert.equal(await g.mode(), 'play');
    // played to its end it stops by itself (the test keeps the monsters off you meanwhile)
    await g.eval(() => { window.__G.P.inv = 1e9; window.__G.P.hp = window.__G.maxHP(); window.__RREP.playI(0); }); await g.step(5);
    for (let i = 0; i < 20 && await g.eval(() => !!window.__RREP.play); i++) await g.step(30);
    assert.equal(await g.eval(() => window.__RREP.play), null, 'over');
    assert.equal(await g.mode(), 'play');

    // a boss gone without dying (it despawned): the recording ends there as left, not at the cap
    await g.eval(() => { const G = window.__G, P = G.P; const m = window.__RREP.boss(); P.x = m.x - 40; P.y = m.y; P.inv = 1e9; window.__bm = m; m.hp = Math.round(m.max * 0.8); });
    await g.step(30);
    assert.ok(await g.eval(() => !!window.__RREP.rec), 'recording');
    await g.step(120);
    await g.eval(() => { const M = window.__G.mons(), i = M.indexOf(window.__bm); M.splice(i, 1); });
    await g.step(40);
    assert.equal(await g.eval(() => window.__RREP.rec), null);
    assert.equal(await g.eval(() => window.__RREP.logs()[0].res), 'left');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
