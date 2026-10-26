'use strict';
// v3.24 (plan U305) Day and night places on the world clock: at night the guards walk a short beat with a lantern and the
// shopkeepers step back behind shuttered counters, still selling (they answer from a tile further off); by day they are back.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('guards walk a night beat, shopkeepers shutter their counters, and all are back by day', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const at = () => g.eval(() => { const N = window.__G.npcs, gd = N.find((n) => n.id === 'guardW'), sh = N.find((n) => n.id === 'marketRh');
      return { g: [Math.round(gd.x), Math.round(gd.y)], s: [Math.round(sh.x), Math.round(sh.y)], shut: !!sh.shut, reach: sh.reach || 0, lit: window.__GNW.night(gd), quest: window.__GNW.night(N.find((n) => n.id === 'grid')) }; });
    await g.eval(() => window.__GVP.force(12)); await g.step(60);
    const day = await at();
    await g.eval(() => window.__GVP.force(23));
    const xs = new Set();
    // the beat follows the world clock (wNow), the real one in the harness: move it on by hand, so the machine's speed doesn't matter
    await g.eval(() => { const t0 = Date.now(); window.__dnK = 0; Date.now = () => t0 + window.__dnK; });
    for (let i = 0; i < 12; i++) { await g.eval((k) => { window.__dnK = k * 900; }, i + 1); await g.step(40); xs.add((await at()).g[0]); }
    const night = await at();
    assert.ok(xs.size > 3, 'the guard walks: ' + [...xs].join(','));
    assert.ok([...xs].every((x) => Math.abs(x - day.g[0]) <= 27), 'a short beat, 1.6 tiles each way');
    assert.equal(night.g[1], day.g[1]);
    assert.equal(night.lit, true, 'with a lantern'); assert.equal(night.quest, false, 'a quest giver keeps her place, unlit');
    assert.equal(night.shut, true, 'the shopkeeper shutters the counter'); assert.equal(night.s[0], day.s[0]);
    const back1 = day.s[1] - night.s[1], stepped = back1 > 8; assert.ok(Math.abs(back1) <= 1 || Math.abs(back1 - 16) <= 2, 'a step back, or none against a wall: ' + back1);
    assert.equal(night.reach, day.reach + (stepped ? 16 : 0), 'answering from as far off as the step');
    await g.eval(() => window.__GVP.force(12)); await g.step(120);
    const back = await at();
    assert.deepEqual([back.g, back.s, back.shut, back.reach], [day.g, day.s, false, day.reach], 'back by day');
    await g.eval(() => window.__GVP.force(null));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
