'use strict';
// Earrings (owner 2026-10-23): their own gear slot with a rating and stats like rings and necklaces; they drop, are forged at
// the anvil, made by Elizabeth and sold by armorers, and they show on the character for you and for the other players.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 10; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}

test('buy and wear earrings: the slot, the stats, the look, and the other player sees them', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Mercedes', g: 1, hair: 12, hc: 2, skin: 0, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const ua = await a.eval(() => Satisfy.local.net().uid);
    const r = await a.eval(() => {
      const G = window.__G, X = G.eqx, S = G.S, mp0 = X.maxMP();
      S.gold = 5000; X.buyGear('iear', 260, 'armorer');
      const it = X.eqIt('e');
      return { id: it && it.id, slot: it && it.slot, r: it && it.r, mpb: it && it.mpb, mp: X.maxMP() - mp0, gold: S.gold, ear: window.__GLK.mine().ear };
    });
    assert.equal(r.id, 'iear'); assert.equal(r.slot, 'e'); assert.ok(r.mpb >= 15 && r.mp >= 15, JSON.stringify(r));
    assert.equal(r.gold, 5000 - 260);
    assert.equal(r.ear, '#c8ccd6', 'the earrings show on her');
    await settle(a, b);
    assert.equal((await b.eval((u) => window.__GLK.theirs(u), ua)).ear, '#c8ccd6', 'and the other player sees them');
    // the eye on the equipment window hides their look, the stats stay
    await a.eval(() => { const G = window.__G; G.S.look.vh = 16; });
    await settle(a, b);
    assert.equal(await a.eval(() => window.__GLK.mine().ear), undefined);
    assert.equal((await b.eval((u) => window.__GLK.theirs(u), ua)).ear, undefined);
    assert.ok(await a.eval(() => window.__G.eqx.eqIt('e').mpb >= 15));
    // a rare rating raises the stats like any gear; Elizabeth makes jewel earrings; the equipment window has the slot
    const m = await a.eval(() => {
      const G = window.__G, X = G.eqx, S = G.S;
      const lo = X.mkItem('mear', 0), hi = X.mkItem('mear', 3);
      S.gold = 1e6; S.mats = S.mats || {}; S.mats.ruby = 5; S.mats.mith = 10;
      const ez = window.__GEZ.make('rbear');
      X.openEquip();
      return { lo: lo.mpb, hi: hi.mpb, ez: ez && ez.id + ':' + ez.slot + ':' + ez.r, slot: document.getElementById('eqR').innerHTML.includes('Earrings') };
    });
    assert.ok(m.hi > m.lo, JSON.stringify(m));
    assert.equal(m.ez, 'rbear:e:3');
    assert.ok(m.slot, 'the earring slot is on the equipment window');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
