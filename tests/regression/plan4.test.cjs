'use strict';
// v3.24 The plan's updates, batch 4, the small ones: U087 one cap (twice the damage) over the Demon Slayer's bonuses on a
// demon together with the holy blessings on evil (Rebecca's blessed weapon, the Vatican's blessing); U127 below. (U114, U120,
// U135 and U139 are main's: regression/u114, u120, u135.)
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('U087: the Demon Slayer on a demon, everything at once, is capped at twice', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const k = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, X = window.__GP2; S.cls = 'dslayer'; S.lv = 200; P.inv = 1e9; P.hp = 1e9;
      const it = G.eqx.mkItem('isword', 1); S.items.push(it); S.eqW = it.uid;
      for (const m of G.mons()) { m.dead = true; m.rt = 1e9; }
      const m = G.spawnMon('demon', P.x + 40, P.y); m.max = m.hp = 1e9; m.lv = 200; m.tmp = 0;
      const plain = X.atk(m); m.dss = 5; const most = X.atk(m, { dem: 1.5 }); it.bls = 1; const blessed = X.atk(m, { dem: 1.5 });
      return { plain, most, blessed };
    });
    assert.ok(Math.abs(k.plain - 1.32) < 1e-9, 'Bane and mastery as before: ' + k.plain);
    assert.ok(Math.abs(k.most - 1.76) < 1e-9, 'the demon part still at +60%: ' + k.most);
    assert.ok(Math.abs(k.blessed * 1.15 - 2) < 1e-9, 'with the blessed weapon on top, twice in all: ' + k.blessed);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// U127 the Storm Elemental's conductivity and its opening when it moves
test('U127 conductivity', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, Y = window.__GMX4, o = {};
      for (const m of G.mons()) { m.dead = true; m.rt = 1e9; }
      P.x = 240 * 16; P.y = 216 * 16; P.inv = 1e9; P.hp = 1e9;
      const se = G.spawnMon('selem', P.x + 40, P.y); se.mvd = 0; se.st = null; o.still = Y.stAtk(se); se.mvd = 1; o.moving = Y.stAtk(se);
      window.__GU.forceWeather('rain'); S.zone = 'zWin'; o.wetRain = Y.wet(); window.__GU.forceWeather(null);
      return o;
    });
    assert.deepEqual([r.still, r.moving], [1, 1.25], 'U127: open while it moves');
    assert.equal(r.wetRain, true, 'rain makes you wet');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
