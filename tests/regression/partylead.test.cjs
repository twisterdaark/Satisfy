'use strict';
// SAT-ONLINE-024 (doc §35 U049): when the leader is gone for good, the remaining members pick one new leader
// (the lowest uid) instead of the party falling apart; it never ends with two leaders.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(games, fn, ms = 10000) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const g of games) await g.step(10);
    await games[0].page.waitForTimeout(30);
  }
}
const party = (g) => g.eval(() => Satisfy.local.net().party);

test('the leader leaves without a word: the two members elect one leader and stay together', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    const c = await H.openGame({ ctx, query: '?net=local&slot=c' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await H.newGame(c, { n: 'Ruby', hair: 2, hc: 1, skin: 0, top: 2 });
    await b.eval(() => { window.__G.P.x += 20; });
    await c.eval(() => { window.__G.P.x -= 30; });
    await settle(a, b, c);
    // A invites both from their cards (U046), they accept with Y
    for (const g of [b, c]) {
      const uid = await g.eval(() => Satisfy.local.net().uid);
      const p = await a.eval((u) => { const r = Satisfy.local.net().remotes.find((x) => x.uid === u); return window.__G.toScreen(r.x, r.y - 30); }, uid);
      await a.page.mouse.click(p.x, p.y);
      await a.step(2);
      await a.eval(() => document.querySelector('#pctx [data-act="pcInvite"]').click());
      await settle(a, b, c);
      await until([g], () => !document.getElementById('partyInv').hidden);
      await g.page.keyboard.press('KeyY');
      await settle(a, b, c);
    }
    await until([a, b, c], () => Satisfy.local.net().party.members.length === 3);
    const uids = [await b.eval(() => Satisfy.local.net().uid), await c.eval(() => Satisfy.local.net().uid)];
    const expect = [...uids].sort()[0];

    await a.close(); // gone (no reload)
    await until([b, c], () => { const p = Satisfy.local.net().party; return !!p.id && p.leader !== null && p.members.length === 2 && p.members.some((m) => m.leader); }, 40000);
    const pb = await party(b), pc = await party(c);
    assert.equal(pb.id, pc.id, 'one party');
    assert.equal(pb.leader, expect);
    assert.equal(pc.leader, expect, 'both picked the lowest uid');
    assert.equal(pb.id, 'p_' + expect);
    assert.equal([pb, pc].filter((p) => p.members.find((m) => m.self).leader).length, 1, 'exactly one leader');
    for (const g of [b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
