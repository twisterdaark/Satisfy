'use strict';
// SAT-ONLINE-044 (owner 2026-10-19: everything the same for everyone, as if on one device): the weather by the server's
// clock even on a device whose clock is off; herbs on the same spots for everyone; a townsperson knocked out in an invasion
// is down on every screen, not only the host's.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) { for (let i = 0; i < 6; i++) { for (const g of games) await g.step(5); await games[0].page.waitForTimeout(30); } }
async function online(ctx, k, uid, name, skew) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  if (skew) await g.eval((d) => { const real = Date.now.bind(Date); Date.now = () => real() + d; window.__fakeRTDB.serverOffset = -d; }, skew);
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  for (let i = 0; i < 80 && !(await g.eval(() => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE')); i++) { await g.step(3); await g.page.waitForTimeout(30); }
  return g;
}

test('weather by the server clock, herbs on the same spots, a knocked-out townsperson is down for everyone', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await online(ctx, 'a', 'gWpA1', 'Ahmed');
    // B's device clock is 37 minutes fast: two weather periods (20 min) away
    const b = await online(ctx, 'b', 'gWpB2', 'Bassem', 37 * 60 * 1000);
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await settle(a, b);
    assert.equal(await b.eval(() => window.__GW.wx()), await a.eval(() => window.__GW.wx()), 'the same weather');
    assert.deepEqual(await b.eval(() => window.__GW.nodes()), await a.eval(() => window.__GW.nodes()), 'herbs on the same spots');

    // an invasion of Winston running on both (the server clock moved to a minute in, for both pages)
    for (const g of [a, b]) await g.eval(() => {
      const EVS = 15 * 60 * 1000, base = Date.now() + (Satisfy.local.net() ? 0 : 0);
      let slot = Math.floor((Date.now() + (window.__fakeRTDB.serverOffset || 0)) / EVS) + 1; while (((slot * 2654435761) >>> 0) % 8 !== 0) slot++;
      const want = slot * EVS + 60000, real = Date.now.bind(Date), cur = Date.now() + (window.__fakeRTDB.serverOffset || 0), d = want - cur;
      Date.now = () => real() + d; void base;
    });
    await settle(a, b);
    const ids = await a.eval(() => window.__GW.npcs());
    const i = ids.findIndex((id) => /^guard/.test(id)) >= 0 ? ids.findIndex((id) => /^guard/.test(id)) : 0;
    await a.eval((k) => window.__GW.knock(k), i);
    assert.equal(await a.eval((id) => window.__GW.ko(id), ids[i]), true);
    for (let k = 0; k < 20 && !(await b.eval((id) => window.__GW.ko(id), ids[i])); k++) await settle(a, b);
    assert.equal(await b.eval((id) => window.__GW.ko(id), ids[i]), true, 'down on B\'s screen too');
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
