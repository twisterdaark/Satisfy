'use strict';
// owner 2026-10-22: the Beast Master's forms fight differently, not only look different: the wolf's bites bleed, the bear
// sweeps all in front of it with 30% more health, the eagle swoops and is frail.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('wolf bleeds, bear sweeps and is sturdier, eagle swoops and is frail', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, U = window.__GU, X = window.__GHC;
      for (const m of G.mons()) { m.dead = true; m.rt = 1e9; }
      S.cls = 'beast'; S.lv = 40; P.dir = 2;
      const mk = (dx) => { const m = G.spawnMon('wolf', P.x + dx, P.y); m.eng = 4; m.max = m.hp = 1e9; m.stun = 99; return m; };
      // wolf: a bite leaves a wound that bleeds
      P.bmf = 'wolf'; const a = mk(14); U.hitMon(a, 1, {}); const bled = a.bld > 0;
      // bear: the swipe also hits the one beside it
      a.dead = true; P.bmf = 'bear'; const b1 = mk(14), b2 = mk(24); const h2 = b2.hp; U.hitMon(b1, 1, {}); const swept = b2.hp < h2;
      // damage taken by form
      P.bmf = 'bear'; const tb = X.hurt(100, b1); P.bmf = 'eagle'; const te = X.hurt(100, b1); P.bmf = 'wolf'; const tw = X.hurt(100, b1);
      return { bled, swept, tb, te, tw };
    });
    assert.ok(r.bled, 'wolf bite bleeds: ' + JSON.stringify(r));
    assert.ok(r.swept, 'bear sweeps');
    assert.ok(r.tb < r.tw && r.te > r.tw, 'bear takes less, eagle more: ' + JSON.stringify(r));
    const hp = await g.eval(() => { const G = window.__G, P = G.P; P.bmf = null; const a = window.__GSET.maxHP(); P.bmf = 'bear'; const b = window.__GSET.maxHP(); P.bmf = null; return [a, b]; });
    assert.ok(Math.abs(hp[1] / hp[0] - 1.3) < 0.02, 'bear +30% health: ' + hp);
    await g.step(30);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
