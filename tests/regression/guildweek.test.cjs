'use strict';
// SAT-ONLINE-081 (plan U233) over the fake Firebase with the rules' checks: the guild's weekly goal. Two members' kills add up
// (each sent as its own count); kills of monsters far below you don't count; one member counts at most 1,500; at 300 the
// guild reaches tier 1 and everyone is told; each member takes the reward once (gold and contribution); the rules refuse a
// second claim, a count that goes down or past the cap, and a player outside the guild.
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
const toasts = (g) => g.eval(() => window.__toastSeen || '');
const keepToasts = (g) => g.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  await keepToasts(g);
  return g;
}
const kills = (g, type, n) => g.eval(([ty, k]) => { for (let i = 0; i < k; i++) window.__GWK.kill(ty); }, [type, n]);
const GID = 'g_gWkA1';
const write = (g, path, v) => g.eval(async ([p, x]) => { const F = window.__GLD.fb(), D = F.m.database; if (x && x.t === 'SV') x.t = D.serverTimestamp(); try { await D.update(D.ref(F.db), { [p]: x }); return 'ok'; } catch (e) { return 'no'; } }, [path, v]);

test('guild weekly goal: kills add up, capped and level-gated; tier reached, told, reward taken once; the rules hold', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gWkA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gWkB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const c = await signIn(ctx, 'c', 'gWkC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await b.eval(() => { window.__G.P.x += 20; });
    await c.eval(() => { window.__G.P.x -= 200; });
    await a.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 50000; });
    await settle(a, b, c);
    await a.eval(() => window.__GG.create('Hunters'));
    await until([a], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    await a.eval(() => { const r = Satisfy.local.net().remotes.find((x) => x.uid === 'gWkB2'); window.__G.P.x = r.x - 16; window.__G.P.y = r.y; });
    await a.step(3); await a.page.keyboard.press('KeyT'); await a.step(2);
    await a.eval(() => document.querySelector('#pctx [data-act="pcGuild"]').click());
    await until([b], () => !document.getElementById('guildInv').hidden);
    await b.eval(() => document.querySelector('#guildInv [data-act="gdYes"]').click());
    await until([b], () => { const s = window.__GG.state(); return !!s && s.rank === 'r'; });
    await until([a, b], () => !!window.__GWK.key);
    const wk = (await a.eval(() => window.__GWK.key)).split('/')[1];
    assert.match(wk, /^w\d{4,6}$/);

    // A at level 60: rabbits don't count; level 1 again: goblins do
    await kills(a, 'rabbit', 50);
    assert.equal(await a.eval(() => window.__GWK.mine), 0, 'far below level 60');
    await a.eval(() => { window.__G.S.lv = 1; });
    await kills(a, 'goblin', 200); await kills(b, 'goblin', 99);
    await settle(a, b);
    await until([a, b], () => window.__GWK.total === 299, 15000);
    assert.equal(await a.eval(() => window.__GWK.tier), 0);
    await kills(b, 'goblin', 1); await settle(a, b);
    await until([a, b], () => window.__GWK.tier === 1, 15000); // both pages step: B's count goes out with its own clock
    await settle(a, b);
    for (const g of [a, b]) assert.match(await toasts(g), /The guild reached tier 1 of the weekly goal! Take your reward in G/);

    // A takes tier 1 from G: +2,000 gold, once
    const g0 = await a.eval(() => window.__G.S.gold);
    await a.eval(() => window.__GWK.open()); await a.step(2);
    assert.match(await a.eval(() => document.getElementById('dialog').textContent), /Guild weekly goal \(resets Monday 00:00 UTC, in /);
    await a.eval(() => window.__G.advance()); await a.step(2);
    assert.match(await a.eval(() => document.getElementById('dtext').textContent), /Tier 1: 300 kills · 2,000 gold · ready · Tier 2: 1,000 kills · 6,000 gold · not yet/);
    await a.eval(() => [...document.querySelectorAll('#dopts button')].find((x) => /Take the tier 1 reward/.test(x.textContent)).click());
    await until([a], () => !!window.__GWK.paid[1]);
    assert.equal(await a.eval(() => window.__G.S.gold), g0 + 2000);
    assert.equal(await write(a, 'guildWeekPaid/' + GID + '/' + wk + '/gWkA1/1', { t: 'SV' }), 'no', 'taken once');

    // B's count stops at 1,500; the rules refuse more, a lower count, and C outside the guild
    await kills(b, 'goblin', 2000);
    assert.equal(await b.eval(() => window.__GWK.mine), 1500);
    await settle(a, b);
    await until([a, b], () => window.__GWK.total === 200 + 1500, 15000);
    assert.equal(await write(b, 'guildWeek/' + GID + '/' + wk + '/gWkB2', { n: 'Bassem', k: 1501, t: 'SV' }), 'no', 'past the cap');
    assert.equal(await write(a, 'guildWeek/' + GID + '/' + wk + '/gWkA1', { n: 'Ahmed', k: 5, t: 'SV' }), 'no', 'never down');
    assert.equal(await write(c, 'guildWeek/' + GID + '/' + wk + '/gWkC3', { n: 'Carim', k: 10, t: 'SV' }), 'no', 'not a member');
    assert.equal(await a.eval(() => window.__GWK.tier), 2, '1,700 kills: tier 2');
    for (const g of [a, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/guildWeek/.test(x))), []);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
