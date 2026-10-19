'use strict';
// SAT-ONLINE-025 (doc §35 U050): party role badges. You pick yours in the party panel; your party sees it.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(g, fn, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}

test('click your badge to pick a role; the other member sees it; it never touches combat', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    assert.equal((await a.eval(() => Satisfy.local.playerPublic())).role, null, 'no role outside a party');
    await a.page.keyboard.press('KeyP');
    await settle(a, b);
    await until(b, () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY');
    await settle(a, b);
    await until(a, () => !!document.querySelector('#partyL button.role'));
    const atk = await a.eval(() => window.__G.S.st.str);
    await a.eval(() => document.querySelector('#partyL button.role').click());
    await settle(a, b);
    assert.equal((await a.eval(() => Satisfy.local.playerPublic())).role, 'tank');
    await until(b, () => { const r = document.querySelector('#partyL span.role'); return r && r.title === 'Tank'; });
    assert.equal(await b.eval(() => Satisfy.local.net().party.members.find((m) => !m.self).role), 'tank');
    // cycle: healer, damage, support, none
    for (const want of ['healer', 'damage', 'support', null]) {
      await a.eval(() => document.querySelector('#partyL button.role').click());
      await a.step(2);
      assert.equal((await a.eval(() => Satisfy.local.playerPublic())).role, want);
    }
    assert.equal(await a.eval(() => window.__G.S.st.str), atk, 'a badge only');
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});
