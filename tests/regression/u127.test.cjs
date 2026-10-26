'use strict';
// Plan U127 (2026-10-26): the Storm Elemental's lightning hits 30% harder in rain or a storm; moving, it takes 25% more.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the Storm Elemental: wet makes its blows worse, moving makes it weaker', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, P = G.P, B = window.__GU, X = window.__GPB7, Q = window.__GPB12;
      const m = G.mons().find((x) => x.type === 'selem' && !x.dead);
      P.hp = P.mhp = 1e9; P.inv = 0;
      B.forceWeather('clear'); const h0 = P.hp; X.hurt(1000, m); const dry = h0 - P.hp;
      B.forceWeather('rain'); P.inv = 0; P.dash = 0; const h1 = P.hp; X.hurt(1000, m); const wet = h1 - P.hp;
      B.forceWeather(null);
      m.mvd = 0; m.st = null; const still = Q.p3Atk(m); m.mvd = 1; const moving = Q.p3Atk(m);
      return { dry, wet, still, moving, toast: [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | ') };
    });
    assert.ok(r.dry > 0 && Math.abs(r.wet / r.dry - 1.3) < 0.03, `30% more when wet (${r.dry} -> ${r.wet})`);
    assert.equal(r.still, 1); assert.equal(r.moving, 1.25);
    assert.match(r.toast, /lightning hits harder in the rain/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
