'use strict';
// SAT-ONLINE-103 (plan U325): the performance profiler. F9 in play, or ?perf, shows frames a second, the frame time
// (p50/p95/max), the work a frame takes (update + drawing, p95), the network and what is on the map, each line red over
// its budget (a frame within 20 ms; the work within 8 ms on a computer, 14 on a phone). Every minute of play the device
// keeps its own numbers (satisfy_perf).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const hud = (g) => g.eval(() => { const e = document.getElementById('perfHud'); return e && !e.hidden ? { text: e.textContent, over: e.dataset.over } : null; });

test('profiler: F9 shows it; p95s from the last 600 frames; red over budget; kept per device every minute', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    assert.equal(await hud(g), null, 'off by default');
    await g.page.keyboard.press('F9'); await g.step(40);
    const h = await hud(g);
    assert.ok(h, 'F9 shows it');
    assert.match(h.text, /^60 fps · computer\nframe 16\.7 \/ p95 16\.7 \/ max 16\.7 ms \(≤ 20\)\nwork p95 \d+(\.\d)? ms = update \d+(\.\d)? \+ draw \d+(\.\d)? \(≤ 8\)\n\d+ monsters · \d+ effects · 0 players$/);
    assert.equal(h.over, '');

    // a slow device: one frame in ten takes 40 ms, the work 12 ms; p95 over 600 frames sees it
    await g.eval(() => { const P = window.__PERF; P.clear(); for (let i = 0; i < 600; i++) P.add(i % 10 ? 16.7 : 40, i % 10 ? 4 : 9, i % 10 ? 2 : 3); });
    const s = await g.eval(() => window.__PERF.stats());
    assert.deepEqual([s.n, s.frame.p50, s.frame.p95, s.frame.max, s.work.p95, s.work.up, s.work.draw], [600, 16.7, 40, 40, 12, 9, 3]);
    assert.deepEqual(s.over, { frame: true, work: true });
    assert.equal(s.fps, Math.round(600 * 1000 / (540 * 16.7 + 60 * 40)));
    await g.step(40);
    assert.equal((await hud(g)).over, 'fw', 'both lines red');
    // a minute of play: this device's numbers kept
    await g.eval(() => window.__PERF.keep());
    const k = await g.eval(() => JSON.parse(localStorage.getItem('satisfy_perf')));
    assert.equal(k.dev, 'computer');
    assert.equal(typeof k.frame95, 'number');
    assert.match(k.scr, /^\d+x\d+$/);

    // F9 again: off
    await g.page.keyboard.press('F9'); await g.step(2);
    assert.equal(await hud(g), null);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('profiler: ?perf shows it from the start', async () => {
  const g = await H.openGame({ query: '?perf' });
  try {
    await g.step(40);
    assert.ok(await hud(g));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
