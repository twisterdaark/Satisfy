'use strict';
// v3.24 The plan's updates, batch 4, the small ones: U087 one cap (twice the damage) over the Demon Slayer's bonuses on a
// demon together with the holy blessings on evil (Rebecca's blessed weapon, the Vatican's blessing); U135, U139, U127 below.
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

// U135 a cultist raises skeletons (worth nothing, crumbling with him); U139 the Antidote Herb; U127 the Storm Elemental's
// conductivity and its opening when it moves
test('U135 raised skeletons, U139 the Antidote Herb, U127 conductivity', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, X = window.__GMX3, Y = window.__GMX4, MT = G.isk.MT, o = {};
      for (const m of G.mons()) { m.dead = true; m.rt = 1e9; }
      P.x = 240 * 16; P.y = 216 * 16; P.inv = 1e9; P.hp = 1e9;
      const c = G.spawnMon('cultist', P.x + 60, P.y); c.lv = 180; const raise = X.movesOf(c).find((v) => v.k === 'raise');
      X.MXK.raise(c, MT.cultist, raise, 60, -60, 0, 0); X.MXK.raise(c, MT.cultist, raise, 60, -60, 0, 0);
      const rz = G.mons().filter((m) => m.type === 'rskel' && !m.dead); o.rz = [rz.length, rz.every((m) => m.lv === 180 && m.tmp), MT.rskel.gold, MT.rskel.drop.length];
      Y.rz(c); o.crumble = G.mons().filter((m) => m.type === 'rskel' && !m.dead).length;
      // the herb: one stops a venom and keeps poison off 20 s
      S.mats.antherb = 2; P.dotT = 0; P.apoU = 0; const pv = { dot: [0.01, 4, 'pois'] };
      const pois = () => { P.dotT = 0; P.dotP = 0; window.__GMXON(pv); return P.dotT > window.__GLG3.now(); };
      o.first = pois(); o.left = S.mats.antherb; o.again = pois(); o.left2 = S.mats.antherb; P.apoU = 0; S.mats.antherb = 0; o.none = pois();
      // conductivity and the opening
      const se = G.spawnMon('selem', P.x + 40, P.y); se.mvd = 0; se.st = null; o.still = Y.stAtk(se); se.mvd = 1; o.moving = Y.stAtk(se);
      window.__GU.forceWeather('rain'); S.zone = 'zWin'; o.wetRain = Y.wet(); window.__GU.forceWeather(null);
      return o;
    });
    assert.deepEqual(r.rz, [3, true, 0, 0], 'U135: three at most, at his level, worth nothing');
    assert.equal(r.crumble, 0, 'and they crumble with him');
    assert.deepEqual([r.first, r.left, r.again, r.left2, r.none], [false, 1, false, 1, true], 'U139: one herb stops the venom and 20 s more; without, it takes');
    assert.deepEqual([r.still, r.moving], [1, 1.25], 'U127: open while it moves');
    assert.equal(r.wetRain, true, 'rain makes you wet');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// U114 the Snow Rabbit and fur; U120 the Frost Slime (water, slowing frost pools) and the rare Gold Slime that blinks away
test('U114 the Snow Rabbit and fur, U120 the Frost and Gold Slimes', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, MT = G.isk.MT, X = window.__GMX3, E = window.__GEL, c = {};
      for (const m of G.mons()) if (['srabbit', 'fslime', 'gslime'].includes(m.type)) c[m.type] = (c[m.type] || 0) + 1;
      const snow = G.mons().filter((m) => m.type === 'srabbit').every((m) => m.y < 36 * 16);
      return { c, snow, fur: [MT.srabbit.drop[0][0], MT.rabbit.drop.some((d) => d[0] === 'fur'), MT.hrabbit.drop.some((d) => d[0] === 'fur')],
        frost: [E.res('fslime', 'water'), X.movesOf({ type: 'fslime' }).some((v) => v.k === 'rain' && v.slow > 0 && v.sp === 'ice')],
        gold: [MT.gslime.gold, X.movesOf({ type: 'gslime' }).some((v) => v.k === 'blink' && v.away)],
        names: ['srabbitN', 'fslimeN', 'gslimeN', 'fur', 'furD'].every((k) => !!G.lines().en[k] && !!G.lines().ar[k]), pics: window.__GMON.missing() };
    });
    assert.deepEqual(r.c, { srabbit: 10, fslime: 8, gslime: 1 }, 'they live in the world');
    assert.equal(r.snow, true, 'the Snow Rabbits in the snow');
    assert.deepEqual(r.fur, ['fur', true, true], 'fur from rabbits');
    assert.deepEqual(r.frost, [0.5, true], 'the Frost Slime resists water and leaves slowing frost');
    assert.deepEqual(r.gold, [600, true], 'the Gold Slime pays and blinks away');
    assert.equal(r.names, true); assert.deepEqual(r.pics, [], 'every monster has a picture');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
