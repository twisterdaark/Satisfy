'use strict';
// v3.21 The plan's updates, batch 2: U350 the demon invasion (Berith's army at Reidan's south gate), U155 sandstorms in the
// deserts, U081 a heal draws the fight toward the healer, U283 an item keeps who held it before through a trade.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the plan, batch 2', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, o = {};
      const E = window.__GU.EVT.find((e) => e.k === 'invD'); o.inv = E ? [E.tw, E.mob.includes('hdemon'), E.cap] : null;
      o.invStr = [G.lines().en.ev_invD, G.lines().en.evN_invD];
      // a sandstorm in the deserts, no rain there
      const z0 = S.zone; window.__GU.forceWeather('storm'); S.zone = 'zWSand'; o.sand = window.__GWX.here(); window.__GU.forceWeather('rain'); o.rain = window.__GWX.here();
      S.zone = 'zWin'; window.__GU.forceWeather('storm'); o.town = window.__GWX.here(); window.__GU.forceWeather(null); S.zone = z0;
      // a heal draws a monster in the fight toward the healer; a boss keeps its own rule
      for (const q of G.mons()) { q.dead = true; q.rt = 1e9; }
      const m = G.spawnMon('wolf', P.x + 60, P.y); m.eng = 4; m.prov = 0; const b = G.spawnMon('trauka', P.x + 80, P.y); b.eng = 4; b.prov = 0;
      window.__GLG3.healAggro(); o.aggro = [m.prov > 0, b.prov === 0];
      // an item from a trade keeps its last owners
      const it = window.__GAP.tin(JSON.stringify({ id: 'failure', r: 1, atk: 300, hist: ['Grid', 'Faker', 'x'.repeat(40), 'Yura', 'Ruby'] }));
      o.hist = it && it.hist; o.tip = it ? window.__GAP.tip(it).includes('Ruby') : false;
      return o;
    });
    assert.deepEqual(r.inv, ['zReid', true, 'furfu'], 'U350: the demon invasion'); assert.ok(r.invStr.every(Boolean));
    assert.deepEqual([r.sand, r.rain, r.town], ['sand', 'clear', 'storm'], 'U155: sandstorms in the deserts');
    assert.deepEqual(r.aggro, [true, true], 'U081: a heal draws the fight');
    assert.deepEqual(r.hist, ['Faker', 'Yura', 'Ruby'], 'U283: the last three owners, nothing too long'); assert.equal(r.tip, true);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
