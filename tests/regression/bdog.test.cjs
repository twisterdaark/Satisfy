'use strict';
// The Beware Dogs Dungeon (v2.99; owner 2026-10-25: "add any place or region of the novel that has an effect"): the mine in
// the Dravian Mountains the insane dragon Nevartan walled in bricks (ch 612, 613), its veins under the bricks ("You have to dig
// up the bricks and then the minerals"; "difficult to mine here unless you're a genius"), insane dragon iron and stone in equal
// measure (ch 623), the hammer a smith makes of them, Minor at its mouth and Khan's word on the iron.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };

test('the way in and up, the notice and the discovery once; the veins: bricks, then the mineral; a Miner never misses; once a day', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.step(5);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, B = window.__GBDG, T = window.__GTRK, o = {};
      const gi = T.gates().find((x) => x.hint === 'hBdog'), gu = T.gates().find((x) => x.hint === 'hUp' && G.zoneAt(x.x, x.y) === 'zBdog');
      o.gate = [Math.round(gi.x / 16 - .5), Math.round(gi.y / 16 - .6), gi.lv || 0]; o.zin = G.zoneAt(gi.to.x, gi.to.y); o.up = [Math.round(gu.to.x / 16 - .5), Math.round(gu.to.y / 16 - .6)];
      o.surf = G.zoneAt(gi.x, gi.y);
      G.P.x = gi.to.x; G.P.y = gi.to.y; B.tick(); o.inside = B.inside(); B.tick();
      o.kinds = B.V.map((v) => v.k).sort().join(','); o.n = B.V.length;
      // below level 250 the veins refuse
      const v9 = B.V[9]; S.lv = 100; B.vein(v9); o.low = B.st(v9); S.lv = 260;
      // anyone: the bricks, then the mineral two times in five
      S.sec = null; B.rnd(() => .9); const v0 = B.V[0]; G.P.x = v0.x; G.P.y = v0.y + 20; o.near = B.near().map((v) => v.i);
      B.vein(v0); o.s1 = B.st(v0); B.vein(v0); o.s2 = B.st(v0); o.fail = S.mats.ndiron || 0;
      const v1 = B.V[1]; B.rnd(() => .1); B.vein(v1); B.vein(v1); o.luck = S.mats.ndstone || 0;
      // a Miner: every vein, as much stone as iron
      S.sec = 'miner'; S.mats.ndiron = 0; S.mats.ndstone = 0; B.rnd(() => .99);
      for (const v of B.V.slice(2)) { B.vein(v); B.vein(v); }
      o.miner = [S.mats.ndiron, S.mats.ndstone]; o.spent = B.V.every((v) => B.st(v) === 2); o.nearSpent = B.near().length;
      // the next day they are full again
      S.dly.day = '2000-01-01'; o.next = B.V.every((v) => B.st(v) === 0);
      B.rnd(null);
      return o; });
    await g.page.waitForTimeout(800); await g.step(3);
    const fd = await g.eval(() => [!!window.__G.S.books.fd_bdog, window.__GNPC.fd('bdog')]);
    assert.deepEqual(r.gate, [934, -8, 0]); assert.equal(r.low, 0, 'level 250 to mine'); assert.equal(r.surf, 'zSahHills'); assert.equal(r.zin, 'zBdog'); assert.deepEqual(r.up, [934, -10]);
    assert.equal(r.inside, true); assert.equal(r.n, 10); assert.equal(r.kinds, 'ndiron,ndiron,ndiron,ndiron,ndiron,ndstone,ndstone,ndstone,ndstone,ndstone');
    assert.deepEqual(r.near, [0]); assert.deepEqual([r.s1, r.s2, r.fail], [1, 2, 0], 'bricks, then a clumsy pick: nothing'); assert.equal(r.luck, 1);
    assert.deepEqual(r.miner, [4, 4], 'a Miner never misses'); assert.equal(r.spent, true); assert.equal(r.nearSpent, 0); assert.equal(r.next, true);
    assert.deepEqual(fd, [true, false], 'the discovery once');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Minor at the mouth, Khan on the iron, the hammer a smith makes of it', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.step(5);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, N = window.__GNPC, X = window.__GIX, o = {};
      const m = G.npcs.find((n) => n.id === 'minor'); o.minor = m ? [Math.round(m.x / 16), Math.round(m.y / 16)] : null;
      o.topics = N.NLD.minor.topics.map((x) => x.id); o.pool = N.pool('minor').length;
      const kt = () => N.NLD.khan.topics.filter((x) => !x.when || x.when()).map((x) => x.id);
      o.khan0 = kt().includes('ndiron'); S.mats.ndiron = 1; o.khan1 = kt().includes('ndiron');
      o.req = X.req('ndhammer'); X.open(); X.tab('smith', 'ndhammer'); o.det = X.det(); X.close();
      o.names = [G.lines().en.ndiron, G.lines().en.ndstone, G.lines().en.ndhammer, G.lines().ar.ndhammer];
      return o; });
    assert.deepEqual(r.minor, [932, -10]);
    assert.deepEqual(r.topics, ['mine', 'bricks', 'iron', 'carnival']); assert.ok(r.pool >= 1);
    assert.deepEqual([r.khan0, r.khan1], [false, true], 'Khan speaks of it once you carry some');
    assert.deepEqual(r.req, { sm: 8, bs: 1 }); assert.match(r.det, /Insane Dragon Iron ×5/); assert.match(r.det, /Insane Dragon Stone ×5/); assert.match(r.det, /Mithril ×10/);
    assert.deepEqual(r.names, ['Insane Dragon Iron', 'Insane Dragon Stone', 'Insane Dragon Hammer', 'مطرقة التنين المجنون']);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
