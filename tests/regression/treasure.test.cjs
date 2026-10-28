'use strict';
// U302 Treasure hunts (SAT-ONLINE-170; plan: "server-seeded clues and locations", check: "unique reward per event").
//   - this week's spot is drawn from the week alone: the same on every page, another one next week, in the West, on ground;
//   - Winston's board hands out the hunt with its region; the line at the top says which way and how far, then "dig here";
//   - E digs it up: blue orichalcum, magic stones and cartography experience, no gold; once a week per character;
//   - the first finder in the world (here, on this device) gets a second share and the news.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the treasure hunt: one spot a week for all, the board, the line, the dig once a week, the first finder', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx }), b = await H.openGame({ ctx });
    await H.newGame(a); await H.newGame(b);
    const sa = await a.eval(() => { const T = window.__GTH, w = T.week(), s = T.spot(w), n = T.spot('w' + (+w.slice(1) + 1)); return { w, s, n }; });
    const sb = await b.eval((w) => window.__GTH.spot(w), sa.w);
    assert.deepEqual(sb, sa.s, 'the same spot on every page');
    assert.ok(sa.s && sa.n && (sa.s.x !== sa.n.x || sa.s.y !== sa.n.y), 'another one next week');
    assert.ok(!/^zEa/.test(sa.s.z), 'in the West');
    await b.close();

    const g = a;
    // the board: the hunt and its region
    const take = await g.eval(() => { const T = window.__GTH; T.take(); return { on: T.on(), text: document.getElementById('dialog').innerText }; });
    assert.equal(take.on, true);
    assert.match(take.text, /This week's treasure is buried in /);
    // through the clue's lines, then Leave
    for (let i = 0; i < 4 && await g.eval(() => !document.querySelector('#dopts button')); i++) { await g.page.keyboard.press('Enter'); await g.step(2); }
    await g.page.locator('#dopts button').last().click(); await g.step(3);
    assert.equal(await g.eval(() => window.__G.mode), 'play');
    // far away: a way and "far"
    assert.match(await g.eval(() => window.__GTH.ui()), /^🗺 Treasure: .+ · (north|south|east|west|north-east|north-west|south-east|south-west) · far$/);
    // at the spot: "dig here", and E digs
    const before = await g.eval((s) => { const G = window.__G, S = G.S, P = G.P; P.x = s.x; P.y = s.y + 4; P.inv = 1e9; return { gold: S.gold, blue: S.mats.blue || 0, ms: S.mats.mstone || 0 }; }, sa.s);
    await g.step(3);
    assert.match(await g.eval(() => window.__GTH.ui()), /Here! Press E to dig/);
    // the ✕ on the line stops the hunt; the line goes
    assert.equal(await g.eval(() => window.__GTH.stop()), false);
    assert.equal(await g.eval(() => window.__GTH.ui()), '');
    await g.eval(() => { window.__G.S.th.on = window.__GTH.week(); });
    assert.equal(await g.eval(() => window.__GTH.near().length), 1);
    await g.page.keyboard.press('e'); await g.step(3);
    const after = await g.eval(() => { const S = window.__G.S; return { gold: S.gold, blue: S.mats.blue || 0, ms: S.mats.mstone || 0, th: S.th, on: window.__GTH.on(), legend: !!(window.__G.WS && (window.__G.WS.legends || {})['th_' + window.__GTH.week()]) }; });
    assert.equal(after.gold, before.gold, 'no gold');
    assert.equal(after.blue - before.blue, 2, 'blue orichalcum: one, and one more as the first finder');
    assert.equal(after.ms - before.ms, 4);
    assert.equal(after.th.got, sa.w);
    assert.equal(after.on, false);
    // once a week: the board says so, and nothing more to dig
    assert.equal(await g.eval(() => window.__GTH.near().length), 0);
    const again = await g.eval(() => { const T = window.__GTH; T.take(); return { on: T.on(), text: document.getElementById('dialog').innerText }; });
    assert.equal(again.on, false);
    assert.match(again.text, /You found this week's treasure/);
    assert.deepEqual(g.errors, []);
    await g.close();
  } finally { await ctx.close(); }
});
