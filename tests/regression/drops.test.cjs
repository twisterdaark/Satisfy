'use strict';
// SAT-ONLINE-048 (owner via Claude-B, #13): a thing dropped from the bag lies on the ground for 60 s for everyone online;
// the first player to step on it gets it (one claim per drop, over the fake Firebase with the rules' checks), and it is
// gone for everyone. An item arrives as a new item of the one who picks it up.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
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
const giveItem = (g) => g.eval(() => {
  const G = window.__G, S = G.S, rc = Satisfy.local.defs().RC.find((r) => r.slot && r.slot !== 'w' && r.def);
  const it = { uid: ++S.uid, id: rc.id, slot: rc.slot, r: 2, dur: 100, def: 7 };
  S.items.push(it); Satisfy.ids.ensure(S); return JSON.parse(JSON.stringify(it));
});
async function drop(g, k) {
  assert.equal(await g.eval((x) => window.__GD.drop(x), k), true, 'the bag has ' + k);
  await g.step(2);
  await g.eval(() => document.getElementById('cfmY').click());
  await g.step(3);
}

test('online: a drop shows for others, the first to step on it gets it once, then it is gone for everyone', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const P = {};
    for (const [k, uid, name, look] of [['a', 'gDrA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }], ['b', 'gDrB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 }]]) {
      const g = P[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
      await H.newGame(g, look);
    }
    const { a, b } = P;
    await b.eval(() => { window.__G.P.x += 60; });
    const it = await giveItem(a);
    await a.eval(() => { window.__G.S.mats.wood = 7; });
    await settle(a, b);

    // A drops the armour piece and the wood: both are in the database, and B sees both on the ground
    await drop(a, it.id);
    await a.eval(() => { window.__G.P.y += 60; }); // the wood a step away, so walking onto the piece doesn't pick both
    await drop(a, 'wood');
    assert.equal(await a.eval((iid) => window.__G.S.items.some((i) => i.iid === iid), it.iid), false, "out of A's bag");
    assert.equal(await a.eval(() => window.__G.S.mats.wood || 0), 0);
    await until([b], () => window.__GD.drops().filter((d) => d.rem).length === 2);
    const seen = await b.eval(() => window.__GD.drops());
    assert.deepEqual(seen.map((d) => [d.k, d.n]).sort(), [[it.id, 1], ['wood', 7]].sort());
    // B walks onto the item after the 2 s lock: B gets it as a new item of its own; it is gone for A too
    await b.page.waitForTimeout(2100);
    const at = seen.find((d) => d.k === it.id);
    await b.eval((p) => { window.__G.P.x = p.x; window.__G.P.y = p.y; }, at);
    await until([b], (id) => window.__G.S.items.some((i) => i.id === id && i.r === 2 && i.def === 7), 10000, it.id);
    const got = await b.eval((id) => window.__G.S.items.filter((i) => i.id === id && i.r === 2 && i.def === 7).map((i) => i.iid), it.id);
    assert.equal(got.length, 1, 'B has it once');
    assert.notEqual(got[0], it.iid, "B's own item now");
    await until([a], () => window.__GD.drops().length === 1, 10000);
    assert.equal((await a.eval(() => window.__GD.drops()))[0].k, 'wood', 'the item is gone for A, the wood is still there');
    // both step on the wood at once: one of them gets the 7 wood, the other nothing
    const w = (await a.eval(() => window.__GD.drops()))[0];
    for (const g of [a, b]) await g.eval((p) => { window.__G.P.x = p.x; window.__G.P.y = p.y; }, w);
    await until([a, b], () => window.__GD.drops().length === 0, 10000);
    await settle(a, b);
    const wa = await a.eval(() => window.__G.S.mats.wood || 0), wb = await b.eval(() => window.__G.S.mats.wood || 0);
    assert.equal(wa + wb, 7, 'the wood went to one player: ' + wa + ' + ' + wb);
    assert.ok(wa === 0 || wb === 0);
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/dropClaims/.test(x))), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
