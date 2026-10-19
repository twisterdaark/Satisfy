'use strict';
// SAT-ONLINE-054 (plan doc D2): a legendary class is one per world online. A becomes the Sword Saint: the record is in the
// database and B's world shows it; B can't become the Sword Saint; a legend B took offline goes online when B plays.
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

test('online: one Sword Saint per world; the record follows the database; a legend taken offline goes online', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const P = {};
    for (const [k, uid, name, look] of [['a', 'gLgA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }], ['b', 'gLgB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 }]]) {
      const g = P[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
      await H.newGame(g, look);
    }
    const { a, b } = P;
    await settle(a, b);
    await until([a, b], () => !!window.__GL.db());
    // A becomes the Sword Saint: the database first, then the class
    await a.eval(() => { window.__G.S.cls = 'warrior'; window.__GL.become('muller'); });
    await until([a], () => window.__G.S.cls === 'saint');
    await until([b], () => { const L = window.__GL.legends(); return !!(L && L.muller && L.muller.n === 'Ahmed'); });
    assert.deepEqual(await a.eval(() => window.__fakeRTDB.data.get('world/satisfy/legends/muller').uid), 'gLgA1');
    // B can't become the Sword Saint now
    await b.eval(() => { window.__G.S.cls = 'warrior'; window.__GL.become('muller'); });
    await settle(a, b);
    assert.equal(await b.eval(() => window.__G.S.cls), 'warrior', 'still a warrior');
    assert.equal(await a.eval(() => window.__fakeRTDB.data.get('world/satisfy/legends/muller').uid), 'gLgA1');
    // a legend B took offline (its own record and class) goes online the next time B plays online, as it is free
    await b.eval(() => { const G = window.__G; G.S.cls = 'braham'; window.__GL.legends().braham = { pid: G.S.pid || (G.S.pid = 'pTestB'), n: 'Faker' }; window.__GL.apply(); });
    await until([a], () => { const L = window.__GL.legends(); return !!(L && L.braham && L.braham.n === 'Bassem'); });
    assert.equal(await a.eval(() => window.__fakeRTDB.data.get('world/satisfy/legends/braham').uid), 'gLgB2');
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
