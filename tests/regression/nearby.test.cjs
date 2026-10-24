'use strict';
// U247 Nearby list (SAT-ONLINE-202; plan: "sorting by in-game distance and visibility", checked by "the press opens the right
// UID"): the players list (O) puts you first, then the players on your map and in your room by distance, with it, then the
// rest by name; each row's ⋯ still opens that very player's card, even with a twin name.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
const rows = (g) => g.eval(() => [...document.querySelectorAll('#plL > div')].map((d) => ({ t: d.querySelector('span').textContent, uid: (d.querySelector('button.pm') || {}).dataset ? d.querySelector('button.pm') && d.querySelector('button.pm').dataset.uid : null, me: d.classList.contains('me') })));

test('the players list: you, then the nearest first with the distance; the ⋯ opens that player', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    const c = await H.openGame({ ctx, query: '?net=local&slot=c' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Twin', hair: 3, hc: 0, skin: 2, top: 1 });
    await H.newGame(c, { n: 'Twin', hair: 2, hc: 1, skin: 0, top: 2 });
    // C next to A, B 20 tiles away (in sight of the presence range), on the plains west of Winston
    for (const [g, dx] of [[a, 0], [b, 320], [c, 24]]) await g.eval((d) => { const G = window.__G; G.P.inv = 1e9; G.P.x = 90 * 16 + d; G.P.y = 60 * 16; }, dx);
    await settle(a, b, c);
    const uidB = await b.eval(() => Satisfy.local.net().uid), uidC = await c.eval(() => Satisfy.local.net().uid);
    await a.page.keyboard.press('KeyO'); await a.step(2);
    let R = await rows(a);
    for (let i = 0; i < 20 && R.length < 3; i++) { await settle(a, b, c); R = await rows(a); }
    assert.equal(R.length, 3, JSON.stringify(R));
    assert.equal(R[0].me, true, 'you first');
    assert.deepEqual(R.slice(1).map((r) => r.uid), [uidC, uidB], 'the nearest first: ' + JSON.stringify(R));
    assert.match(R[1].t, /right here$/);
    assert.match(R[2].t, /20 tiles away$/);
    // the ⋯ of C's row opens C's card (two Twins): an invite from it reaches C, not B
    await a.eval((u) => document.querySelector('#plL button.pm[data-uid="' + u + '"]').click(), uidC);
    await a.step(2);
    assert.equal(await a.eval(() => !document.getElementById('pctx').hidden), true);
    await a.eval(() => document.querySelector('#pctx [data-act="pcInvite"]').click());
    await settle(a, b, c);
    assert.equal(await c.eval(() => !document.getElementById('partyInv').hidden), true, 'C was invited');
    assert.equal(await b.eval(() => !document.getElementById('partyInv').hidden), false, 'B, with the same name, was not');
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
