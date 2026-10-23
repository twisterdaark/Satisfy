'use strict';
// SAT-ONLINE-155 (owner 2026-10-23: "1:1 for everyone, with no differences"): what a player wears shows on the others'
// screens as on their own. Before, the others drew only the hair, its colour, the skin, the shirt and whether armour was
// on: a bought costume, the dyed cape and trousers and the helmet, gloves and boots were seen by nobody else. Two pages over
// the local transport: B builds A's figure from what A publishes, and it must be the very figure A's own page draws.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 10; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
const mine = (g) => g.eval(() => window.__GLK.mine());
const seen = (g, uid) => g.eval((u) => window.__GLK.theirs(u), uid);
// worn as the equipment window puts them on (whatever level they ask for)
const wear = (g, ids) => g.eval((ids) => { const G = window.__G, S = G.S; S.eq = S.eq || {}; for (const id of ids) { const it = G.eqx.mkItem(id, 1); S.items.push(it); S.eq[it.slot] = it.uid; } }, ids);

test("a costume, dyes, helmet, gloves and boots: the other player's screen draws you as yours does", async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await settle(a, b);
    const ua = await a.eval(() => Satisfy.local.net().uid);
    assert.deepEqual(await seen(b, ua), await mine(a), 'the plain look, as before');
    assert.equal(await a.eval(() => window.__GLK.pub()), '', 'nothing to add: no tag');

    // dyed cape and trousers, an iron helmet, leather gloves, mithril boots
    await a.eval(() => { const S = window.__G.S; S.look.cape = 3; S.look.pants = 5; });
    await wear(a, ['ihelm', 'lgloves', 'mgboots']); // mgboots: an m..., drawn as mithril
    await settle(a, b);
    assert.equal(await a.eval(() => window.__GLK.pub()), '3.5..ilm');
    const fa = await mine(a);
    assert.ok(fa.cape && fa.glove && fa.hair === 'helm', 'A wears them: ' + JSON.stringify(fa));
    assert.deepEqual(await seen(b, ua), fa, "B's copy of A is A's own figure");

    // a costume hides the armour and the gear on A's screen, and so on B's
    await a.eval(() => { window.__G.S.look.cos = 'noble'; });
    await settle(a, b);
    assert.equal(await a.eval(() => window.__GLK.pub()), '3.5.noble.---');
    assert.deepEqual(await seen(b, ua), await mine(a), 'the costume, the same on both');

    // all off again: the plain look on both
    await a.eval(() => { const L = window.__G.S.look; delete L.cos; delete L.cape; delete L.pants; const S = window.__G.S; S.eq = {}; });
    await settle(a, b);
    assert.equal(await a.eval(() => window.__GLK.pub()), '');
    assert.deepEqual(await seen(b, ua), await mine(a));

    // what a page doesn't know (a newer page's dye, costume or tier) is left off, never an error
    assert.deepEqual(await b.eval(() => window.__GLK.of('99.2.party.qi-')), { g: '-i-', pants: 2 });
    assert.equal(await b.eval(() => window.__GLK.of('3.5.<b>.ilm')), null);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
