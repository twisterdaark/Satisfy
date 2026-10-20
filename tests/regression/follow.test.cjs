'use strict';
// SAT-ONLINE-068 (plan U055): party follow. A follows B from B's card: A walks after B and stops a step behind; a move
// key of A's own stops it; Follow is only on a party mate's card. Local tabs (nothing is sent: it is A's own movement).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 6; i++) { for (const g of games) await g.step(4); await games[0].page.waitForTimeout(30); }
}
async function until(games, fn, ms = 10000, arg) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn, arg))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const g of games) await g.step(5);
    await games[0].page.waitForTimeout(30);
  }
}
const pos = (g) => g.eval(() => [Math.round(window.__G.P.x), Math.round(window.__G.P.y)]);
const gap = async (a, b) => { const [p, q] = [await pos(a), await pos(b)]; return Math.hypot(p[0] - q[0], p[1] - q[1]); };

test('party follow: walks after the mate, stops a step behind, a move key stops it; only for party mates', async () => {
  const ctx = await H.newContext({ scripts: [H.fixedClock()] });
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    // not in a party: no Follow
    const uidB = await b.eval(() => Satisfy.local.net().uid);
    assert.equal(await a.eval((u) => window.__GFO.start(u), uidB), false, 'only a party mate');
    await a.page.keyboard.press('KeyP');
    await until([b], () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY');
    await until([a, b], () => Satisfy.local.net().party.members.length === 2);
    // the card shows Follow
    await a.page.keyboard.press('KeyT'); await a.step(2);
    assert.equal(await a.eval(() => document.getElementById('pctxFo').textContent), 'Follow');
    await a.eval(() => document.getElementById('pctxFo').click()); await a.step(2);
    assert.equal(await a.eval(() => window.__GFO.on), uidB);
    // B walks right for a while: A comes after it and ends a step behind
    await b.page.keyboard.down('KeyD');
    for (let i = 0; i < 10; i++) await settle(a, b);
    await b.page.keyboard.up('KeyD');
    for (let i = 0; i < 6; i++) await settle(a, b);
    const g1 = await gap(a, b);
    assert.ok(g1 <= 40, 'a step behind: ' + g1);
    assert.ok(g1 > 5, 'not on top of B: ' + g1);
    // a key of A's own stops it
    await a.page.keyboard.down('KeyA'); await a.step(3); await a.page.keyboard.up('KeyA');
    assert.equal(await a.eval(() => window.__GFO.on), null);
    assert.match(await a.eval(() => document.getElementById('toasts').textContent), /You stopped following/);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
