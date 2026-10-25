'use strict';
// SAT-ONLINE-182 fishing feel (owner 2026-10-24: "improve the visuals and effects; more fun"):
//   - a catch weighs something, by kind and Fishing level: within its kind's range, the heavy ones rare;
//   - a real cast at the water: the float, the bite, E at the bite: the fish leaps to you, its weight shows, and your
//     heaviest of that kind is kept; a heavier one later is a new record, cheered;
//   - none of it on the game's random numbers: the catch itself is what it was.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('fishing: weights by kind, a real cast that leaps to you, the records', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.eval(() => { const G = window.__G; G.P.inv = 1e9; window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
    // the weights
    const w = await g.eval(() => { const F = window.__GFS, o = {}; for (const k of ['fish', 'sfish', 'gfish']) { const a = []; for (let i = 0; i < 300; i++) a.push(F.weight(k, 0)); o[k] = { min: Math.min(...a), max: Math.max(...a), mean: a.reduce((x, y) => x + y, 0) / a.length }; } o.lv = window.__GFS.weight('fish', 20); return o; });
    assert.ok(w.fish.min >= 0.4 && w.fish.max <= 2.6, JSON.stringify(w.fish));
    assert.ok(w.sfish.min >= 0.6 && w.sfish.max <= 3.4, JSON.stringify(w.sfish));
    assert.ok(w.gfish.min >= 1.2 && w.gfish.max <= 5.5, JSON.stringify(w.gfish));
    assert.ok(w.fish.mean < (0.4 + 2.6) / 2, 'the heavy ones are rare: ' + w.fish.mean);
    // a real cast: next to the water
    const spot = await g.eval(() => window.__GFS.water());
    assert.ok(spot, 'water near Winston');
    await g.eval((s) => { const P = window.__G.P; P.x = s[0]; P.y = s[1]; }, spot);
    await g.step(3);
    assert.equal(await g.eval(() => window.__GFS.start()), true, 'a cast');
    for (let i = 0; i < 80 && await g.eval(() => { const F = window.__GFS.F; return F && F.t < F.bite; }); i++) await g.step(5);
    await g.step(2);
    assert.ok(await g.eval(() => { const F = window.__GFS.F; return F && F.t >= F.bite; }), 'a bite');
    const before = await g.eval(() => Object.assign({}, window.__G.S.mats));
    await g.eval(() => window.__GFS.act());
    assert.equal(await g.eval(() => window.__GFS.leaps), 1, 'it leaps to you');
    await g.step(40); await g.page.waitForTimeout(600); await g.step(5);
    const after = await g.eval(() => ({ mats: Object.assign({}, window.__G.S.mats), rec: window.__GFS.rec(), leaps: window.__GFS.leaps, t: window.__toastSeen }));
    const kind = ['fish', 'sfish', 'gfish', 'rtrout', 'mackerel', 'snapper', 'icepike', 'catfish', 'bogeel', 'ecarp', 'jadekoi'].find((k) => (after.mats[k] || 0) > (before[k] || 0)); // v3.03: each water its own fish
    assert.ok(kind, 'a fish in the bag');
    assert.ok(after.rec[kind] > 0, 'its weight kept: ' + JSON.stringify(after.rec));
    assert.equal(after.leaps, 0);
    assert.match(after.t, /You caught a \d+\.\d kg /);
    // later, a heavier one: a new record, cheered
    let got = false;
    for (let i = 0; i < 40 && !got; i++) { await g.eval(() => window.__GFS.catch('fish')); await g.step(2); await g.page.waitForTimeout(560); await g.step(2); got = /New record! A \d+\.\d kg Fish/.test(await g.eval(() => window.__toastSeen)); }
    assert.ok(got, 'a new record');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
