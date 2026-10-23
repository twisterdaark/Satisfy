'use strict';
// SAT-ONLINE-165 (owner 2026-10-23, with a player's screenshot: "I equipped it and I still look the same"): "make sure every
// armour, glove and the rest changes the character's look instead of it being fixed; now it is all the same picture, and draw
// whatever is missing". Before, every armour drew the same leather pads, and a helmet, gloves or boots one of three tiers.
//   - every armour, helmet, glove and boot piece in the game has a look of its own, and wearing it changes your sprite: no two
//     pieces of a slot alike;
//   - a hidden piece (the eye in the equipment window) and a costume show as before;
//   - the others see the same: B's copy of A is A's own figure, piece by piece;
//   - every weapon is drawn in the hand (three drew nothing).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('every armour, helmet, glove and boot piece has its own look, and wearing it changes you; hidden or under a costume, as before', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => {
      // a hash of the player's whole sheet (every direction and pose) as the game draws it now
      const sheet = () => { const c = window.__GLK.sheet(), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
      const G = window.__G, S = G.S, L = window.__GLK, ids = L.ids(), out = { missing: [], dup: [], same: [], n: {} };
      const clear = () => { S.eq = {}; S.eqA = null; };
      const wear = (sl, id) => { const it = G.eqx.mkItem(id, 1); S.items.push(it); if (sl === 'a') S.eqA = it.uid; else (S.eq = S.eq || {})[sl] = it.uid; return it; };
      clear(); const bare = sheet();
      for (const [sl, id] of ids) if (!L.GEARL[id]) out.missing.push(sl + ':' + id);
      const by = {};
      for (const [sl, id] of ids) {
        clear(); wear(sl, id); const h = sheet();
        if (h === bare) out.same.push(sl + ':' + id);
        (by[sl] = by[sl] || {})[h] = (by[sl][h] || []).concat(id);
      }
      for (const sl in by) { out.n[sl] = ids.filter((x) => x[0] === sl).length; for (const h in by[sl]) if (by[sl][h].length > 1) out.dup.push(by[sl][h].join('=')); }
      // the eye hides a piece's look: as if not worn
      clear(); wear('a', 'tgarmor'); wear('h', 'tghelm'); const worn = sheet();
      S.look.vh = 8 | 1; out.hidden = sheet() === bare; delete S.look.vh; out.back = sheet() === worn;
      // a costume covers the gear: two armours under it look the same
      const fresh = () => { for (const k in window.__GU.SH) if (k.startsWith('me~')) delete window.__GU.SH[k]; }; // as buildMe does when the look changes
      S.look.cos = 'noble'; fresh(); clear(); wear('a', 'parmor'); const c1 = sheet(); clear(); wear('a', 'dgarmor'); out.cos = c1 === sheet(); delete S.look.cos; fresh();
      clear();
      return out;
    });
    assert.deepEqual(r.missing, [], 'pieces with no look of their own');
    assert.ok(r.n.a >= 15 && r.n.h >= 12 && r.n.g >= 10 && r.n.b >= 11, JSON.stringify(r.n));
    assert.deepEqual(r.same, [], 'worn and still the same picture');
    assert.deepEqual(r.dup, [], 'two pieces of a slot drawn alike');
    assert.ok(r.hidden, 'the eye hides them');
    assert.ok(r.back, 'and shown again');
    assert.ok(r.cos, 'a costume over the armour, as before');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('every weapon is drawn in the hand', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const miss = await g.eval(() => Object.keys(window.__GLK.wsh()).filter((id) => !window.SatArt.weapons.sprite(id, 0)));
    assert.deepEqual(miss, []);
  } finally { await g.close(); }
});

async function settle(...games) {
  for (let i = 0; i < 10; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}

test("the others see each piece as you do: B's copy of A is A's own figure", async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await settle(a, b);
    const ua = await a.eval(() => Satisfy.local.net().uid);
    const wear = (ids) => a.eval((ids) => { const G = window.__G, S = G.S; S.eq = {}; S.eqA = null; for (const id of ids) { const it = G.eqx.mkItem(id, 1); S.items.push(it); if (it.slot === 'a') S.eqA = it.uid; else S.eq[it.slot] = it.uid; } }, ids);
    for (const set of [['tgarmor', 'tghelm', 'tggloves', 'tgboots'], ['ttshell', 'tthelm', 'ttboots'], ['vpaj', 'rphelm', 'alexg', 'bboots'], ['mgarmor', 'mghelm', 'mggloves', 'mgboots']]) {
      await wear(set); await settle(a, b);
      const mine = await a.eval(() => window.__GLK.mine()), seen = await b.eval((u) => window.__GLK.theirs(u), ua);
      assert.deepEqual(seen, mine, set.join(' '));
    }
    assert.equal(await a.eval(() => window.__GLK.gr()), 'mgarmor.mgboots.mggloves.mghelm');
    // the helmet hidden: '-' in its place, and the same on both
    await a.eval(() => { window.__G.S.look.vh = 1; }); await settle(a, b);
    assert.equal(await a.eval(() => window.__GLK.gr()), 'mgarmor.mgboots.mggloves.-');
    assert.deepEqual(await b.eval((u) => window.__GLK.theirs(u), ua), await a.eval(() => window.__GLK.mine()));
    // a tag that isn't ids is dropped, never an error
    assert.equal(await b.eval(() => window.__GLK.grOf('a.b.<c>.d')), null);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
