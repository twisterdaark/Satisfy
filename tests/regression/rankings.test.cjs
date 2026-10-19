'use strict';
// SAT-ONLINE-055: the rankings clerk's lists are real online: each player's level and gold go to the database, and the
// board shows the real players among the canon rankers.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

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

test('online: the level and wealth lists show the real players among the canon rankers', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const P = {};
    for (const [k, uid, name, look] of [['a', 'gRkA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }], ['b', 'gRkB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 }]]) {
      const g = P[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
      await H.newGame(g, look);
    }
    const { a, b } = P;
    // A is a rich high-level player: on B's board after A's next write and B's next refresh
    await a.eval(() => { const S = window.__G.S; S.lv = 300; S.gold = 9.9e6; window.__GK2.now(); });
    await until([a], () => window.__fakeRTDB.data.has('ranks/lv/gRkA1'));
    assert.deepEqual(await a.eval(() => window.__fakeRTDB.data.get('ranks/gold/gRkA1').v), 9900000);
    await b.eval(() => window.__GK2.now());
    await until([b], () => !!window.__GK2.data());
    const lv = await b.eval(() => window.__GK2.list('lv')), gold = await b.eval(() => window.__GK2.list('gold'));
    assert.match(lv, /Ahmed · Lv 300/, 'A among the rankers: ' + lv.split('\n').slice(0, 4).join(' | '));
    assert.match(gold.split('\n')[0], /^1\. Ahmed · 9,900,000 G$/, 'the richest first');
    assert.match(lv, /Kraugel|كراوجل|Lv 312/, 'the canon rankers are still there');
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
