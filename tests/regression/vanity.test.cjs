'use strict';
// Vanity outfits over the armour (owner 2026-10-23): new outfits at Layla the stylist with a rating and light stats that count
// while worn; the rare ones drop from bosses and are not sold. The other player sees the outfit.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 10; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}

test('buy and wear an outfit: its stats count while worn, a boss drops a rare one, the other player sees it', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Mercedes', g: 1, hair: 12, hc: 2, skin: 0, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const ua = await a.eval(() => Satisfy.local.net().uid);
    const r = await a.eval(() => {
      const G = window.__G, S = G.S, C = window.__GCOS, hp0 = G.eqx.maxHP ? G.eqx.maxHP() : null, mp0 = G.eqx.maxMP();
      S.gold = 100000; C.pick('maid'); const on = S.look.cos, fig = window.__GLK.mine();
      const sold = C.pick('vamp'), lockedVamp = !S.cos.vamp;
      return { on, skirt: !!fig.skirt, apron: fig.apron, gold: S.gold, hpp: C.b('hpp'), lockedVamp, menu: Object.keys(C.COS).length };
    });
    assert.equal(r.on, 'maid'); assert.ok(r.skirt, 'the maid outfit has its skirt'); assert.equal(r.apron, '#f4f2ec');
    assert.equal(r.gold, 100000 - 8000); assert.equal(r.hpp, .02, 'her HP +2% while she wears it');
    assert.ok(r.lockedVamp, 'a boss outfit is not sold'); assert.ok(r.menu >= 23);
    await settle(a, b);
    assert.equal((await b.eval((u) => window.__GLK.theirs(u), ua)).apron, '#f4f2ec', 'the other player sees the outfit');
    // a vampire city's master drops the vampire lord attire (forced roll); then it is hers to wear
    const d = await a.eval(() => {
      const G = window.__G, S = G.S, C = window.__GCOS; C.CODROP.vamp[1] = 1;
      C.drop({ type: 'vlord', x: G.P.x, y: G.P.y }, { boss: 1 });
      const own = !!S.cos.vamp; C.pick('vamp');
      return { own, on: S.look.cos, dm: C.b('dm'), hpp: C.b('hpp') };
    });
    assert.deepEqual(d, { own: true, on: 'vamp', dm: .03, hpp: .03 });
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
