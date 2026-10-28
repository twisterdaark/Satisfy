'use strict';
// SAT-ONLINE-084 (plan U231) over the fake Firebase with the rules' checks: the guild master picks a banner from a fixed
// set in G; it shows before the guild's name under a member's name on another player's screen and in G; a member can't
// change it; a value outside the set is refused; handing the guild over keeps it.
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
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  return g;
}
const GID = 'g_gBnA1';
const guildW = (g, v) => g.eval(async ([gid, x]) => { const F = window.__GLD.fb(), D = F.m.database, cur = window.__fakeRTDB.data.get('guilds/' + gid); try { await D.update(D.ref(F.db), { ['guilds/' + gid]: Object.assign({}, cur, x) }); return 'ok'; } catch (e) { return 'no'; } }, [GID, v]);

test('guild banners: picked by the master from a fixed set, seen by others, kept through a handover', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gBnA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gBnB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const c = await signIn(ctx, 'c', 'gBnC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await b.eval(() => { window.__G.P.x += 20; });
    await c.eval(() => { window.__G.P.x -= 60; });
    await a.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 50000; });
    await settle(a, b, c);
    await a.eval(() => window.__GG.create('Dragons'));
    await until([a], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    await a.eval(() => { const r = Satisfy.local.net().remotes.find((x) => x.uid === 'gBnB2'); window.__G.P.x = r.x - 16; window.__G.P.y = r.y; });
    await a.step(3); await a.page.keyboard.press('KeyT'); await a.step(2);
    await a.eval(() => document.querySelector('#pctx [data-act="pcGuild"]').click());
    await until([b], () => !document.getElementById('guildInv').hidden);
    await b.eval(() => document.querySelector('#guildInv [data-act="gdYes"]').click());
    await until([b], () => { const s = window.__GG.state(); return !!s && s.rank === 'r'; });
    assert.equal((await a.eval(() => window.__GBAN.E())).length, 16, 'none and 15 symbols');

    // A picks the dragon in G -> Guild banner
    await a.eval(() => window.__GBAN.open()); await a.step(2);
    await a.eval(() => [...document.querySelectorAll('#dopts button, #gwB .gwopts button')].find((x) => x.textContent.includes('🐉')).click());
    await until([a], () => (window.__fakeRTDB.data.get('guilds/g_gBnA1') || {}).emb === 3);
    // C, outside the guild, sees it under A's and B's names (another guild's name and banner are read again after a minute)
    await c.step(3700); await settle(a, b, c);
    const seen = () => c.eval(() => { const x = window.__GBAN.of('gBnB2'); return !!x && x.emb === 3 && x.n === 'Dragons'; });
    for (let i = 0; i < 40 && !(await seen()); i++) await settle(a, b, c); // all three step: presence keeps flowing
    assert.equal(await seen(), true, "C sees B's banner");
    assert.equal(await c.eval(() => { const x = window.__GBAN.of('gBnA1'); return x && x.emb; }), 3);
    // in G for the members
    await b.page.keyboard.press('KeyG'); await b.step(2); await b.eval(() => window.__GDW.tab('x')); await b.step(2);
    assert.match(await b.eval(() => (window.__GDW.on() ? window.__GDW.text() : document.getElementById('dtext').textContent)), /🐉 Dragons/);
    await b.page.keyboard.press('Escape'); await b.step(2);
    // a member can't change it; nobody can set one outside the set
    await assert.rejects(b.eval(() => window.__GBAN.set(5)), /rank/);
    assert.equal(await guildW(b, { emb: 5 }), 'no', 'only the master writes the guild');
    assert.equal(await guildW(a, { emb: 16 }), 'no', 'outside the set');
    assert.equal(await guildW(a, { emb: 2.5 }), 'no');
    // handing the guild over keeps the banner
    await a.eval(() => window.__GG.rank('gBnB2', 'o'));
    await until([b], () => window.__GG.state().rank === 'o');
    await a.eval(() => window.__GLD.hand('gBnB2'));
    await until([a, b], () => (window.__fakeRTDB.data.get('guilds/g_gBnA1') || {}).master === 'gBnB2');
    assert.equal(await a.eval(() => window.__fakeRTDB.data.get('guilds/g_gBnA1').emb), 3);
    for (const g of [a, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/guilds write|guilds fields|guildMembers write/.test(x))), []);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
