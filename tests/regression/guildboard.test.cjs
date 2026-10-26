'use strict';
// v3.24 (plan U364) A world boss's guild board over the fake Firebase: the host counts each guild's damage to it (by the
// guild each player's presence shows) and shows the top five in its presence; at the kill every player who earned it reads
// the board, and their guild's place pays a share of the boss's gold by tier, once a kill.
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

test("the guild board: the host counts by guild, the board rides in its presence, a guild's place pays by tier", async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gbA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gbB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await settle(a, b);
    for (const [g, n] of [[a, 'Hunters'], [b, 'Wolves']]) {
      await g.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 50000; });
      await g.eval((x) => window.__GG.create(x), n);
      await until([g], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    }
    await b.eval(() => { window.__G.P.x = window.__G.P.x + 20; });
    await settle(a, b);
    await until([a], () => Satisfy.local.net().remotes.some((r) => r.gd === 'g_gbB2'));
    // the zone's host (the first one in it) counts: Hunters do 30% of the dragon's health, Wolves 10%, someone with no guild nothing
    await until([a, b], () => !!window.__GGB.hostOf());
    const hu = await a.eval(() => window.__GGB.hostOf());
    assert.equal(await b.eval(() => window.__GGB.hostOf()), hu, 'one host for both');
    const [H0, F0, myF] = hu === 'gbA1' ? [a, b, 'Wolves'] : [b, a, 'Hunters'];
    await until([H0], (u) => Satisfy.local.net().remotes.some((r) => r.gd === 'g_' + u), 10000, hu === 'gbA1' ? 'gbB2' : 'gbA1');
    const pub = await H0.eval(() => { const G = window.__G, X = window.__GGB; const m = G.spawnMon('trauka', G.P.x + 200, G.P.y); m.tmp = 1;
      X.add(m, 'gbA1', m.max * 0.3); X.add(m, 'gbB2', m.max * 0.1); X.add(m, 'nobody', m.max * 0.2); return { board: X.board(m), pub: X.pub() }; });
    assert.deepEqual(pub.board, [['g_gbA1', 300], ['g_gbB2', 100]]);
    assert.equal(pub.pub, 'trauka.g_gbA1:300.g_gbB2:100');
    // the other reads the host's board from its presence; at the kill its guild's place pays: Hunters 1st 100%, Wolves 2nd 60% of 60,000
    await until([F0, H0], () => { const B = window.__GGB.host('trauka'); return !!B && B.L.length === 2; });   /* the host steps too: its presence goes out */
    const g0 = await F0.eval(() => window.__G.S.gold), want = myF === 'Wolves' ? 36000 : 60000, place = myF === 'Wolves' ? 2 : 1;
    await F0.eval(() => { const G = window.__G; const m = G.spawnMon('trauka', G.P.x + 200, G.P.y); m.tmp = 1; window.__GGB.pay(m); });
    await F0.page.waitForTimeout(1700); await F0.step(5);
    assert.equal(await F0.eval(() => window.__G.S.gold) - g0, want, 'paid by its place');
    await F0.page.waitForTimeout(1000); await F0.step(3);
    const ts = await F0.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | '));
    assert.match(ts, /The guilds against .+: 1\. Hunters [\d.]+% · 2\. Wolves [\d.]+%/, 'the board (a share of its health now: online a world boss grows with the players)');
    assert.match(ts, new RegExp('Your guild «' + myF + '» placed ' + place + ': \\+' + want.toLocaleString('en') + ' gold'));
    // once a kill: a second kill message right after pays nothing
    await F0.eval(() => { const G = window.__G; const m = G.spawnMon('trauka', G.P.x + 200, G.P.y); m.tmp = 1; window.__GGB.pay(m); });
    await F0.page.waitForTimeout(1700); await F0.step(5);
    assert.equal(await F0.eval(() => window.__G.S.gold) - g0, want, 'paid once');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
