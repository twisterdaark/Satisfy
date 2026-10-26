'use strict';
// Plan U156 (Reinhardt capital): "50 avatars drawn in one place stay within the frame budget". Fifty other sessions stand
// around the player on the local network (each its own presence on the same channel, as fifty tabs would), and the
// frames are timed with the wall clock: the game's own profiler times frames with performance.now, which the harness
// freezes between steps, so it reads 0 here. The budget is the profiler's: a frame within 20 ms (p95).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const N = 50, BUDGET = 20;
const frames = (g, n) => g.eval((n) => {
  const t = [];
  for (let i = 0; i < n; i++) { const a = Date.now(); window.__step(1); t.push(Date.now() - a); }
  t.sort((x, y) => x - y);
  return { p50: t[Math.floor(n * 0.5)], p95: t[Math.floor(n * 0.95)], max: t[n - 1] };
}, n);

test('fifty players drawn in one place stay within the frame budget', async () => {
  const g = await H.openGame({ query: '?net=local' });
  try {
    await g.page.setViewportSize({ width: 1280, height: 720 });
    await H.newGame(g);
    await frames(g, 120);   // warm up: the first frames after the start build sheets and caches
    const alone = await frames(g, 120);
    // fifty sessions in a 10 × 5 block around the player, each with its own presence on the local channel
    const publish = () => g.eval(() => {
      const P = window.__G.P;
      for (const f of window.__CROWD) {
        const pp = Satisfy.local.playerPublic({ uid: f.uid, sid: f.sid });
        pp.x = Math.round(P.x + ((f.i % 10) - 4.5) * 14); pp.y = Math.round(P.y + (Math.floor(f.i / 10) - 2) * 16);
        f.pres.publish(pp, true);
      }
    });
    await g.eval((N) => {
      window.__CROWD = [];
      for (let i = 0; i < N; i++) {
        const sid = 'crowd' + String(i).padStart(2, '0') + 'aaaaaaaaaaaaaa', uid = 'crowd-' + i;
        const pres = Satisfy.presence.create({ transport: Satisfy.transports.local('satisfy-net-v1'), uid, sid, world: Satisfy.local.world(), now: () => performance.now() });
        window.__CROWD.push({ pres, sid, uid, i });
      }
    }, N);
    await publish(); await g.page.waitForTimeout(150); await g.step(10); await publish(); await g.page.waitForTimeout(150); await g.step(10);
    const seen = await g.eval(() => window.__PERF.stats().ents.remotes);
    assert.equal(seen, N, 'all fifty are there');
    let crowd = { p50: 0, p95: 0, max: 0 };
    for (let k = 0; k < 3; k++) {   // three rounds of 60 frames, the crowd kept fresh between them
      const f = await frames(g, 60);
      crowd = { p50: Math.max(crowd.p50, f.p50), p95: Math.max(crowd.p95, f.p95), max: Math.max(crowd.max, f.max) };
      await publish(); await g.page.waitForTimeout(60);
    }
    assert.equal(await g.eval(() => window.__PERF.stats().ents.remotes), N, 'still fifty after the frames');
    console.log('frame ms alone', JSON.stringify(alone), 'with fifty', JSON.stringify(crowd));
    // the budget; on a machine slower than the budget even alone (a loaded CI runner), fifty may add at most 8 ms to its own p95
    const cap = Math.max(BUDGET, alone.p95 + 8);
    assert.ok(crowd.p95 <= cap, `with fifty players the frame p95 is ${crowd.p95} ms (cap ${cap}; alone ${alone.p95})`);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
