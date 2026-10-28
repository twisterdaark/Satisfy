'use strict';
// U252 Player profile card (SAT-ONLINE-209; plan: "public rank, title, look, stats preview", checked by "no private
// currencies"): a player's card shows their figure from their public look (the same sheet as in the world: a different look
// is a different figure) and, online, their arena rating this season with wins and losses from the public ranks, or that they
// have no arena duels; never gold or anything private.
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
async function cardFromList(g, uid) {
  if (await g.eval(() => !document.getElementById('pctx').hidden)) { await g.eval(() => document.querySelector('#pctx [data-act="pcClose"]').click()); await g.step(2); }
  if (await g.eval(() => document.getElementById('plW').hidden)) await g.page.keyboard.press('KeyO');
  for (let i = 0; i < 40 && !(await g.eval((u) => !!document.querySelector('#plL button.pm[data-uid="' + u + '"]'), uid)); i++) { await g.step(3); await g.page.waitForTimeout(30); }
  await g.eval((u) => document.querySelector('#plL button.pm[data-uid="' + u + '"]').click(), uid);
  await g.step(2);
}
// the portrait's pixels: how many are drawn, and a hash of them
const pic = (g) => g.eval(() => { const c = document.getElementById('pctxPic'); if (c.hidden) return null; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, h = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) { n++; h = (h * 31 + d[i - 3] * 7 + d[i - 2] * 3 + d[i - 1]) >>> 0; } return { n, h, k: window.__GPC.pic() }; });

test('the card shows the player as everyone sees them; two looks, two figures; nothing private', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    const c = await H.openGame({ ctx, query: '?net=local&slot=c' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Twin', hair: 3, hc: 0, skin: 2, top: 1 });
    await H.newGame(c, { n: 'Other', hair: 2, hc: 1, skin: 0, top: 2 });
    for (const [g, dx] of [[a, 0], [b, 40], [c, -40]]) await g.eval((d) => { const G = window.__G; G.P.x = 90 * 16 + d; G.P.y = 60 * 16; G.P.inv = 1e9; }, dx);
    await settle(a, b, c);
    const uidB = await b.eval(() => Satisfy.local.net().uid), uidC = await c.eval(() => Satisfy.local.net().uid);
    await cardFromList(a, uidB);
    assert.equal(await a.eval(() => !document.getElementById('pctx').hidden), true);
    const pb = await pic(a);
    assert.ok(pb && pb.n > 150, 'a figure is drawn: ' + JSON.stringify(pb));
    // the same sheet as B's figure in A's world: B's hair 3, colour 0, skin 2, top 1
    assert.match(pb.k, /^rp_3_0_2_1_/);
    await cardFromList(a, uidC);
    const pc = await pic(a);
    assert.match(pc.k, /^rp_2_1_0_2_/);
    assert.notEqual(pc.h, pb.h, 'another look, another figure');
    // offline (no ranks to read): no arena line; nothing private either way
    assert.equal(await a.eval(() => document.getElementById('pctxRk').textContent), '');
    assert.doesNotMatch(await a.eval(() => document.getElementById('pctx').textContent), /gold|Gold|bank|Bank/);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('online, the card has the arena rating this season from the public ranks, or "no arena duels"', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock()] });
  try {
    const P = {};
    for (const [k, uid, name, look] of [['a', 'gPcA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }], ['b', 'gPcB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 }]]) {
      const g = P[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
      await H.newGame(g, look);
    }
    const { a, b } = P;
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    const uidB = await b.eval(() => Satisfy.local.net().uid);
    // no rating yet
    await cardFromList(a, uidB);
    await until([a], () => document.getElementById('pctxRk').textContent !== '');
    assert.equal(await a.eval(() => document.getElementById('pctxRk').textContent), 'No arena duels this season');
    // B's rating this season, as the arena writes it
    await a.eval((u) => { const d = new Date(Date.now()), se = 's' + d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0'); window.__fakeRTDB.data.set('arena/' + se + '/' + u, { n: 'Bassem', r: 1234, w: 5, l: 2, t: Date.now() }); window.__GPC.rk.clear(); }, uidB);
    await cardFromList(a, uidB);
    await until([a], () => /Arena/.test(document.getElementById('pctxRk').textContent));
    assert.equal(await a.eval(() => document.getElementById('pctxRk').textContent), 'Arena: 1234 (5 won / 2 lost)');
    assert.doesNotMatch(await a.eval(() => document.getElementById('pctx').textContent), /gold|Gold|bank|Bank/);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
