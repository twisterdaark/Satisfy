'use strict';
// Plan U135 (2026-10-26): Yatan's cultists raise skeletons in a fight, two at most; they fall with their cultist.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('a cultist raises two skeletons at most, and they fall with it', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, P = G.P, U = window.__GU135;
      const c = G.mons().find((m) => m.type === 'cultist' && !m.dead && !m.tmp);
      P.x = c.x - 200; P.y = c.y; P.inv = 1e9; c.eng = 4; c.hp = c.max - 1;
      for (let i = 0; i < 5; i++) U.raise(c, 20);
      const sk = G.mons().filter((m) => m.cult === c && !m.dead);
      window.__C = c;
      return { n: sk.length, tmp: sk.every((k) => k.tmp && k.noLoot && k.xmul === 0.25 && k.type === 'skel') };
    });
    assert.equal(r.n, 2, 'two at most'); assert.equal(r.tmp, true, 'summons: no loot, a quarter of the XP');
    await g.eval(() => { window.__C.dead = true; });
    await g.step(3);
    assert.equal(await g.eval(() => window.__G.mons().filter((m) => m.cult === window.__C && !m.dead).length), 0, 'they fall with their cultist');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
