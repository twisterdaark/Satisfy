'use strict';
// SAT-ONLINE-112 (plan U371): a reconnect soak over the fake Firebase. Two players in a party lose the connection again
// and again (one, the other, both at once) and move while they are away. After every reconnect each sees the other
// once, where the other really is, still in one party; and after the twentieth the pages listen to exactly what they
// listened to after the first (a reconnect that added a listener or an onDisconnect each time would grow without end).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 6; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(25); }
}
async function until(games, fn, ms = 10000, arg) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn, arg))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const g of games) await g.step(5);
    await games[0].page.waitForTimeout(25);
  }
}
const net = (g) => g.eval(() => { const n = Satisfy.local.net(); return { state: n.state, count: n.count, remotes: n.remotes.map((r) => ({ uid: r.uid, x: r.x })), party: n.party ? n.party.members.length : 0 }; });
const active = (g) => g.eval(() => window.__fakeRTDB.active());

test('reconnect soak: 20 drops keep presence, positions, the party and the listeners as they were', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock()] });
  try {
    const pages = {};
    for (const [k, uid, name] of [['a', 'gSkA1', 'Soaka'], ['b', 'gSkB2', 'Soakb']]) {
      const g = pages[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.data.set('handles/' + n.toLowerCase(), u); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
    }
    const { a, b } = pages;
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    await a.page.keyboard.press('KeyP');
    await until([b], () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY');
    await until([a, b], () => Satisfy.local.net().party.members.length === 2, 15000);
    await settle(a, b);

    let first = null;
    for (let i = 0; i < 20; i++) {
      const who = i % 5 === 4 ? [a, b] : i % 2 ? [a] : [b]; // b, a, b, a, both, …
      for (const g of who) await g.eval(() => window.__fakeRTDB.setConnected(false));
      await settle(a, b);
      for (const g of who) assert.equal((await net(g)).state, 'RECONNECTING', 'cycle ' + i);
      if (who.length === 1) assert.equal((await net(who[0] === a ? b : a)).count, 0, 'cycle ' + i + ': the other no longer sees it');
      for (const g of who) await g.eval((k) => { window.__G.P.x += k % 3 ? 6 : -4; }, i); // moves while away
      for (const g of who) await g.eval(() => window.__fakeRTDB.setConnected(true));
      await until([a, b], () => { const n = Satisfy.local.net(); return n.state === 'ONLINE' && n.count === 1; }, 10000);
      await settle(a, b);
      const [na, nb] = [await net(a), await net(b)];
      const [ax, bx] = [await a.eval(() => Math.round(window.__G.P.x)), await b.eval(() => Math.round(window.__G.P.x))];
      assert.deepEqual([na.remotes.length, nb.remotes.length], [1, 1], 'cycle ' + i + ': each sees the other once');
      assert.equal(Math.round(na.remotes[0].x), bx, 'cycle ' + i + ': a sees b where b is');
      assert.equal(Math.round(nb.remotes[0].x), ax, 'cycle ' + i + ': b sees a where a is');
      assert.deepEqual([na.party, nb.party], [2, 2], 'cycle ' + i + ': still one party');
      if (i === 0) {
        first = [await active(a), await active(b)];
        for (const f of first) assert.ok(f.child > 0 && f.value > 0 && f.conn > 0 && f.discon.length > 0, JSON.stringify(f));
      }
    }
    assert.deepEqual([await active(a), await active(b)], first, 'no listener or onDisconnect added by reconnecting');
    const pres = await a.eval(() => [...window.__fakeRTDB.data.keys()].filter((k) => /^presence\/satisfy\/main\/[^/]+$/.test(k)).sort());
    assert.deepEqual(pres, ['presence/satisfy/main/gSkA1', 'presence/satisfy/main/gSkB2'], 'one presence entry each');
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});
