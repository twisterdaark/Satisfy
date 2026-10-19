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
      const p = await a.eval((u) => { const r = Satisfy.local.net().remotes.find((x) => x.uid === u); return window.__G.toScreen(r.x, r.y - 10); }, uid);
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

// review fix (#55): online, members far apart see each other only through the party query. The first to elect moves
// to the new id, so every member also follows the ids a new leader could have; the party must not split.
test('online, members far apart: the leader vanishes, both elect the same leader and stay one party', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const pages = {};
    for (const [k, uid, name] of [['a', 'zLead', 'Ahmed'], ['b', 'mOne', 'Bassem'], ['c', 'mTwo', 'Celine']]) {
      const g = pages[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
    }
    const { a, b, c } = pages;
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await H.newGame(c, { n: 'Ruby', hair: 2, hc: 1, skin: 0, top: 2 });
    await b.eval(() => { window.__G.P.x += 20; });
    await c.eval(() => { window.__G.P.x -= 30; });
    await settle(a, b, c);
    for (const g of [b, c]) {
      const uid = await g.eval(() => Satisfy.local.net().uid);
      const p = await a.eval((u) => { const r = Satisfy.local.net().remotes.find((x) => x.uid === u); return window.__G.toScreen(r.x, r.y - 10); }, uid);
      await a.page.mouse.click(p.x, p.y);
      await a.step(2);
      await a.eval(() => document.querySelector('#pctx [data-act="pcInvite"]').click());
      await settle(a, b, c);
      await until([g], () => !document.getElementById('partyInv').hidden);
      await g.page.keyboard.press('KeyY');
      await settle(a, b, c);
    }
    await until([a, b, c], () => Satisfy.local.net().party.members.length === 3, 20000);
    // B walks far east, C far west: 3000 px apart, well outside each other's 800 px interest range
    await b.eval(() => { window.__G.P.x += 1500; });
    await c.eval(() => { window.__G.P.x -= 1500; });
    await settle(a, b, c); await settle(a, b, c);
    assert.equal(await b.eval(() => Satisfy.local.net().party.members.length), 3, 'still seen through the party query');
    await a.close(); // gone without a word
    await until([b, c], () => { const p = Satisfy.local.net().party; return p.id === 'p_mOne' && p.members.length === 2; }, 90000);
    const pb = await party(b), pc = await party(c);
    assert.equal(pb.leader, 'mOne');
    assert.equal(pc.leader, 'mOne');
    assert.ok(pb.members.find((m) => m.self).leader, 'B leads');
    for (const g of [b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
