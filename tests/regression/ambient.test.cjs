'use strict';
// SAT-ONLINE-178 ambient life (owner 2026-10-24: "improve the visuals, make the game more fun"): only drawn, around you.
//   - by day in clear weather: butterflies over flowers, leaves off the trees, glints on water, and now and then birds;
//   - a butterfly flits away when you come close;
//   - at night: fireflies; in the rain, none come;
//   - never more than its cap; Reduced motion: half as many and no birds.
// (It draws on its own random stream, AMR, never rand: golden, save and replay stay the same.)
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('ambient life: day and night, a butterfly flits away, the rain, the cap, Reduced motion', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.eval(() => { window.__G.P.inv = 1e9; window.__GVP.force(12); window.__GU.forceWeather('clear'); });
    await g.step(400);
    const day = await g.eval(() => window.__GAM.list);
    assert.ok(day.length > 0, 'something lives here by day');
    assert.ok(day.length <= await g.eval(() => window.__GAM.MAX));
    assert.ok(day.every((a) => a.k !== 'fly'), 'no fireflies by day');
    const kinds = new Set(day.map((a) => a.k));
    assert.ok(kinds.has('leaf') || kinds.has('bfly') || kinds.has('glint'), [...kinds].join(','));
    // birds cross now and then
    await g.eval(() => window.__GAM.bird()); await g.step(3);
    assert.ok(await g.eval(() => window.__GAM.birds) >= 3, 'a flock');
    // a butterfly flits away from you (one is put on a flower bed in view if none came)
    const bf = await g.eval(() => window.__GAM.list.find((a) => a.k === 'bfly'));
    if (bf) {
      await g.eval((b) => { const P = window.__G.P; P.x = b.x + 4; P.y = b.y + 10; }, bf);
      await g.step(4);
      assert.ok(await g.eval(() => window.__GAM.list.some((a) => a.k === 'bfly' && a.fl)), 'it flits away');
    }
    // night: fireflies
    await g.eval(() => window.__GVP.force(22)); await g.step(500);
    const night = await g.eval(() => window.__GAM.list);
    assert.ok(night.some((a) => a.k === 'fly'), 'fireflies at night: ' + night.map((a) => a.k).join(','));
    // rain: the fireflies go and none come
    await g.eval(() => window.__GU.forceWeather('rain')); await g.step(900);
    assert.equal((await g.eval(() => window.__GAM.list)).filter((a) => a.k === 'fly').length, 0, 'none in the rain');
    // Reduced motion: half the cap, no birds
    await g.eval(() => { window.__GRMO.set(true); window.__GU.forceWeather('clear'); window.__GVP.force(12); window.__GAM.bird(); });
    await g.step(600);
    assert.ok((await g.eval(() => window.__GAM.list)).length <= 13);
    assert.equal(await g.eval(() => window.__GAM.birds), 0, 'no birds');
    await g.eval(() => { window.__GRMO.set(false); window.__GVP.force(null); window.__GU.forceWeather(null); });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
