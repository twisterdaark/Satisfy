'use strict';
// Side work's experience (v3.02; the player Suki through the owner 2026-10-25: "Make crafting, smithing, cooking any sort of
// side activity give exp proportional to your level"): every life-skill point and smithing point gives 0.015% of the current
// level, up to 30% of a level a day.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('a share of your level per point, up to 30% a day; the status window says how much today', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(5);
    const r = await g.eval(() => { const G = window.__G, S = G.S, X = window.__GSDX, o = {};
      S.lv = 300; S.xp = 0; const need = G.xpNeed();
      X.life('fish', 6); o.fish = S.xp / need;
      S.xp = 0; X.side(68); o.smith = S.xp / need;
      S.xp = 0; X.side(100000); o.cap = S.xp / need; const x1 = S.xp; X.side(50); o.after = S.xp - x1;
      o.fishLife = (S.life || {}).fish || 0;
      // (review) the 30% is what you get, the XP potion included
      S.dly.day = '2000-01-02'; S.xp = 0; S.xpb = Date.now() + 3600e3; X.side(100000); o.capPot = S.xp / need; S.xpb = 0;
      // (review) at a low level the fractions add up: 50 herb picks are not nothing
      S.dly.day = '2000-01-03'; S.lv = 1; S.xp = 0; for (let i = 0; i < 50; i++) X.side(4); o.low = S.xp; S.lv = 300;
      S.dly.day = '2000-01-01'; S.xp = 0; X.side(10); o.next = S.xp / need;
      return o; });
    assert.ok(Math.abs(r.fish - 6 * .00015) < 2e-5, 'six fishing points: ' + r.fish);
    assert.ok(Math.abs(r.smith - 68 * .00015) < 2e-5, 'a legendary piece at the anvil: ' + r.smith);
    assert.ok(r.cap > .28 && r.cap < .3 + 1e-6, 'up to the day\'s 30%: ' + r.cap); assert.equal(r.after, 0, 'nothing more today');
    assert.ok(r.fishLife >= 6, 'the skill still grows');
    assert.ok(Math.abs(r.next - 10 * .00015) < 2e-5, 'the next day again');
    assert.ok(r.capPot > .28 && r.capPot < .3 + 1e-6, 'the XP potion does not lift the 30%: ' + r.capPot);
    assert.ok(r.low >= 1, 'small grants add up at level 1: ' + r.low);
    await g.page.keyboard.press('KeyC'); await g.step(2);
    assert.match(await g.eval(() => document.getElementById('sbody').innerText), /Side work XP today\s*0\.2% of 30%/i);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
