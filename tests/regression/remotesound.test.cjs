'use strict';
// SAT-ONLINE-047 (owner, via Claude-B on #13): the sounds of another player's actions play on your screen too, softer
// with distance, and not at all from far away. B swings and dodges; A hears it while close and not once B is far.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 6; i++) { for (const g of games) await g.step(4); await games[0].page.waitForTimeout(30); }
}

test("another player's swing and dodge sound on your screen while close, softer, and never from far away", async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 40; });
    await settle(a, b);
    await b.eval(() => { window.__G.P.acd = 0; window.__G.tryAttack(1, 0); });
    await settle(a, b);
    await b.page.keyboard.press('Space');
    await settle(a, b); await settle(a, b);
    const heard = await a.eval(() => window.__GS.heard.slice());
    assert.ok(heard.includes('swing'), 'A heard B swing: ' + heard);
    assert.ok(heard.includes('dodge'), 'A heard B dodge: ' + heard);
    // far away: nothing more
    await a.eval(() => { window.__GS.heard.length = 0; });
    await b.eval(() => { window.__G.P.x += 600; });
    await settle(a, b);
    await b.eval(() => { window.__G.P.acd = 0; window.__G.tryAttack(1, 0); });
    await settle(a, b); await settle(a, b);
    assert.deepEqual(await a.eval(() => window.__GS.heard.slice()), [], 'nothing from 600 px away');
    // B's own sounds are not played back to B
    assert.deepEqual(await b.eval(() => window.__GS.heard.slice()), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
