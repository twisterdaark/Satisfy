'use strict';
// ?net=local starts the network while the page is still loading (netStart runs from top-level code), so anything netStart
// calls must not touch a let/const declared further down. SAT-ONLINE-173's pollStart did (POLLOFF), the exception stopped the
// rest of the script, and every local multiplayer test failed with "Cannot access 'TOUCH' before initialization"
// (SAT-ONLINE-213). This boots two local players and checks nothing threw.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the game loads and plays with the local network on, without an error', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    for (let i = 0; i < 8; i++) { await a.step(7); await b.step(7); await a.page.waitForTimeout(30); }
    assert.equal(await a.eval(() => Satisfy.local.net().remotes.length), 1, 'A sees B');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
