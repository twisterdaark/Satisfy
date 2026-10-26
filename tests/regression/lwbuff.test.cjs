'use strict';
// The Lightning Warrior made stronger (the player Soki through the owner 2026-10-26: "buff/add skills to most legendary classes,
// focus on lightning warrior"): the current reaches two foes from level 200, Lightning Storm at 300, every skill still casts.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the Lightning Warrior: the current on two foes, Lightning Storm, every skill casts', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const c = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, A = window.__GSKF;
      S.cls = 'lwarrior'; S.lv = 400; G.isk.checkSkills();
      const sk = ['kypalm', 'kyspear', 'kycur', 'kyapp', 'kysup', 'kytrans', 'kygod', 'kystorm'].filter((x) => S.sk[x]);
      for (const m of G.mons()) m.dead = true;
      const a = G.spawnMon('wolf', P.x + 20, P.y), b = G.spawnMon('wolf', P.x + 50, P.y), d = G.spawnMon('wolf', P.x + 60, P.y + 20);
      for (const x of [a, b, d]) { x.max = x.hp = 1e7; x.tmp = 0; } P.mp = 1e6; A.cast('kypalm');
      const hit = [a, b, d].map((x) => 1e7 - x.hp > 0);
      for (const k of ['kyspear', 'kyapp', 'kysup', 'kytrans', 'kygod', 'kystorm']) { P.cd[k] = 0; P.mp = 1e6; A.cast(k); }
      return { sk, hit }; });
    assert.deepEqual(c.sk, ['kypalm', 'kyspear', 'kycur', 'kyapp', 'kysup', 'kytrans', 'kygod', 'kystorm']);
    assert.deepEqual(c.hit, [true, true, true], 'the palm and the current on two more foes');
    await g.step(120);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
