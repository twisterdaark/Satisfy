'use strict';
// Owner 2026-10-20: "add sounds for hits and skills, above all the enemies". Every monster type has a voice; a monster near
// you is heard when it sees you, winds up, strikes, is hit and dies, and nothing is heard from one far away.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('every monster type has a voice for each moment', async () => {
  const g = await H.openGame();
  try {
    const bad = await g.eval(() => window.__G.monNames().map(([k]) => k).filter((k) => {
      const v = window.__G.vox(k); return !v || ['a', 'w', 's', 'h', 'd'].some((m) => typeof v[m] !== 'function');
    }));
    assert.deepEqual(bad, []);
  } finally { await g.close(); }
});

test('a wolf near you is heard seeing you, winding up, striking, hit and dying; a far one is not', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const ev = (f, x) => g.eval(f, x);
    const heard = async (dx, ty) => {
      await ev(([dx, ty]) => {
        const G = window.__G; G.P.x = 90 * 16; G.P.y = 60 * 16; G.P.inv = 99;
        for (const m of G.mons()) { m.dead = true; m.rt = 1e9; }
        window.__GS.vox.length = 0;
        window.__mv = G.spawnMon(ty, G.P.x + dx, G.P.y);
      }, [dx, ty]);
      await g.step(30);
      for (const f of [() => { window.__mv.eng = 4; }, () => { window.__mv.st = 'tele'; window.__mv.mv = { k: 'arc' }; },
        () => { window.__mv.st = 'rec'; }, () => { window.__mv.hp -= 5; }, () => { window.__mv.dead = true; window.__mv.rt = 1e9; }]) {
        await ev(f); await g.step(1);
      }
      return ev(() => window.__GS.vox.slice());
    };
    const near = await heard(40, 'wolf');
    for (const k of ['a', 'w', 's', 'h', 'd']) assert.ok(near.includes('wolf:beast:' + k), k + ' in ' + near);
    assert.deepEqual(await heard(600, 'wolf'), []);
  } finally { await g.close(); }
});
