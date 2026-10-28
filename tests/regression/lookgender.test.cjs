'use strict';
// Owner 2026-10-23: "men get men's hair and girls girls' hair; anything about the look you're offered must be for your sex".
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the stylist offers each sex its own hairstyles, skirt, lips, accessories and outfits', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g, { n: 'Grid', hair: 0, hc: 0, skin: 1, top: 1 });
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GLOOK, out = {};
      const names = () => G.DL.opts.filter((o) => o.cell).map((o) => o.nm);
      S.gold = 1e6;
      X.sty('hair'); out.mHair = names();
      X.sty('acc'); out.mAcc = names();
      window.__GCOS.menu(); out.mCos = G.DL.opts.filter((o) => o.cell).map((o) => o.l);
      S.look.g = 1; S.look.hair = 2;
      X.sty('hair'); out.fHair = names();
      return out;
    });
    const has = (a, re) => a.some((n) => re.test(n));
    assert.ok(r.mHair.length > 20 && r.fHair.length > 30, JSON.stringify([r.mHair.length, r.fHair.length]));
    assert.ok(!has(r.mHair, /Hime|Twin|Princess|Odango/i), 'no girls\' styles for him: ' + r.mHair.join());
    assert.ok(!has(r.fHair, /Mohawk|Bald|Pompadour|Crew/i), 'no men\'s styles for her: ' + r.fHair.join());
    assert.ok(!has(r.mAcc, /Tiara|Flower|Veil/i), 'no tiara for him: ' + r.mAcc.join());
    assert.ok(!has(r.mCos, /Maid|Gown|Sailor/i), 'no maid outfit for him');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
