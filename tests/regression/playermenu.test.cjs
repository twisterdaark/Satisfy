'use strict';
// SAT-ONLINE-020 (doc §35 U046 nearby player context, U064 inspect): click another player to see their public card
// and invite, challenge or block exactly that player (by uid), even when two players share a name.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
const shown = (g, id) => g.eval((i) => !document.getElementById(i).hidden, id);
const text = (g, id) => g.eval((i) => document.getElementById(i).textContent, id);
// click the name over a remote player's head on g's screen (SAT-ONLINE-026: a click on the sprite attacks)
async function clickRemote(g, uid) {
  const p = await g.eval((u) => { const r = Satisfy.local.net().remotes.find((x) => x.uid === u); return window.__G.toScreen(r.x, r.y - 30); }, uid);
  await g.page.mouse.click(p.x, p.y);
  await g.step(2);
}

test('click a player: their card, and invite/duel/block go to that uid even with a twin name', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    const c = await H.openGame({ ctx, query: '?net=local&slot=c' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Twin', hair: 3, hc: 0, skin: 2, top: 1 });
    await H.newGame(c, { n: 'Twin', hair: 2, hc: 1, skin: 0, top: 2 });
    // plains west of Winston (duels allowed), B right of A, C left of A, nothing else around
    for (const [g, dx] of [[a, 0], [b, 40], [c, -40]]) {
      await g.eval((d) => { const G = window.__G; G.P.x = 90 * 16 + d; G.P.y = 60 * 16; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } }, dx);
    }
    await settle(a, b, c);
    const uidB = (await b.eval(() => Satisfy.local.net().uid)), uidC = (await c.eval(() => Satisfy.local.net().uid));
    await a.eval(() => { window.__G.P.acd = 0; });

    // click C (the left Twin): its card shows, no attack swing
    await clickRemote(a, uidC);
    assert.equal(await shown(a, 'pctx'), true);
    assert.equal(await text(a, 'pctxT'), 'Twin');
    assert.match(await text(a, 'pctxI'), /^Lv \d+/);
    assert.doesNotMatch(await text(a, 'pctxI'), /gold|Gold/, 'nothing private');
    assert.equal(await a.eval(() => window.__G.P.acd > 0), false, 'the click opened the card instead of attacking');

    // invite from the card: only C (not the other Twin) gets it
    await a.eval(() => document.querySelector('#pctx [data-act="pcInvite"]').click());
    await settle(a, b, c);
    assert.equal(await shown(c, 'partyInv'), true, 'C was invited');
    assert.equal(await shown(b, 'partyInv'), false, 'B, with the same name, was not');
    assert.equal((await c.eval(() => Satisfy.local.net().party.invite)).from, await a.eval(() => Satisfy.local.net().uid));

    // B's card: challenge goes to B only
    await clickRemote(a, uidB);
    assert.equal(await a.eval(() => document.querySelector('#pctx').hidden), false);
    await a.eval(() => document.querySelector('#pctx [data-act="pcDuel"]').click());
    await settle(a, b, c);
    assert.equal(await shown(b, 'duelInv'), true, 'B got the challenge');
    assert.equal(await shown(c, 'duelInv'), false);
    assert.equal((await a.eval(() => Satisfy.local.net().duel)).foe, uidB);

    // Block from the card toggles to Unblock; Escape closes the card without pausing
    await a.eval(() => document.querySelector('#pctx [data-act="pcBlock"]').click());
    await a.step(2);
    assert.deepEqual((await a.eval(() => Satisfy.local.net().blocked)).map((x) => x.uid), [uidB]);
    assert.equal(await text(a, 'pctxB'), 'Unblock');
    await a.eval(() => document.querySelector('#pctx [data-act="pcBlock"]').click());
    await a.step(2);
    assert.deepEqual(await a.eval(() => Satisfy.local.net().blocked), []);
    await a.page.keyboard.press('Escape');
    await a.step(2);
    assert.equal(await shown(a, 'pctx'), false);
    assert.equal(await a.eval(() => window.__G.mode), 'play');

    // a click on empty ground still attacks
    await a.eval(() => { window.__G.P.acd = 0; });
    const g0 = await a.eval(() => window.__G.toScreen(window.__G.P.x, window.__G.P.y - 60));
    await a.page.mouse.click(g0.x, g0.y);
    await a.step(1);
    assert.ok(await a.eval(() => window.__G.P.acd > 0), 'swung');
    assert.equal(await shown(a, 'pctx'), false);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('the card closes when that player goes away', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 30; });
    await settle(a, b);
    await clickRemote(a, await b.eval(() => Satisfy.local.net().uid));
    assert.equal(await shown(a, 'pctx'), true);
    await b.close();
    for (let i = 0; i < 6 && (await shown(a, 'pctx')); i++) { await a.step(60); await a.page.waitForTimeout(50); }
    assert.equal(await shown(a, 'pctx'), false);
    assert.match(await text(a, 'toasts'), /Faker is not nearby any more/);
    assert.deepEqual(a.errors, []);
  } finally { await ctx.close(); }
});
