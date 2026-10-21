'use strict';
// SAT-ONLINE-078 (plan U229) over the fake Firebase with the rules' checks: a guild posts that it is recruiting; a player
// without a guild sees it at the Guild Association and asks to join; the master is told and sees the requests; turning one
// down stops that player asking again for a week; "Invite" sends the usual invitation and the player joins; nobody can ask
// a guild that isn't recruiting, and an application never makes anyone a member by itself.
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
// the dialog: advance to the line with the options, then their labels (without the key numbers)
async function opts(g) {
  for (let i = 0; i < 4 && await g.eval(() => document.getElementById('dopts').hidden); i++) { await g.eval(() => window.__G.advance()); await g.step(2); }
  return g.eval(() => [...document.querySelectorAll('#dopts button')].map((x) => x.textContent.replace(/^\d+\.\s*/, '')));
}
const pick = (g, re) => g.eval((src) => { const r = new RegExp(src); [...document.querySelectorAll('#dopts button')].find((x) => r.test(x.textContent)).click(); }, re.source);
const text = (g) => g.eval(() => document.getElementById('dialog').textContent);
const GID = 'g_gRcA1';
const direct = (g, uid, n) => g.eval(async ([gid, u, nm]) => { try { await window.__GREC.store().apply(gid, u, { n: nm, lv: 1 }); return 'ok'; } catch (e) { return 'no'; } }, [GID, uid, n]);

test('guild recruiting: post, ask to join, told, turn down (a week), invite and join, stop', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gRcA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gRcB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const c = await signIn(ctx, 'c', 'gRcC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await a.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 50000; });
    await settle(a, b, c);
    await a.eval(() => window.__GG.create('Hirers'));
    await until([a], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    assert.equal(await direct(b, 'gRcB2', 'Bassem'), 'no', 'a guild that is not recruiting takes no requests');

    // A posts; C sees it and asks
    await a.eval(() => window.__GREC.post('We need tanks for the Goblin Chief'));
    await settle(a, c); // A's page is watching the requests before any arrives
    await c.eval(() => window.__GREC.list()); await c.step(2);
    const o1 = await opts(c);
    assert.match(await text(c), /Hirers \(1 members\): We need tanks for the Goblin Chief/);
    assert.ok(o1.includes('Ask to join Hirers'), o1.join(' | '));
    await pick(c, /Ask to join Hirers/); await c.step(2);
    await until([c], () => !document.getElementById('dopts').hidden && /Ask to join Hirers\?/.test(document.getElementById('dialog').textContent));
    await pick(c, /^1\. /); // Yes
    await until([c], () => /You asked to join Hirers/.test(window.__toastSeen));
    await until([a], () => !!window.__GREC.apps().gRcC3, 15000);
    await settle(a, c);
    assert.match(await toasts(a), /Carim asks to join the guild/);
    assert.equal(await a.eval(() => window.__fakeRTDB.data.has('guildMembers/g_gRcA1/gRcC3')), false, 'asking makes nobody a member');
    // B asks too
    assert.equal(await direct(b, 'gRcB2', 'Bassem'), 'ok');
    await until([a], () => !!window.__GREC.apps().gRcB2, 15000);
    assert.equal(await direct(b, 'gRcC3', 'Bassem'), 'no', 'nobody asks in someone else\'s name');

    // A turns C down from the requests in G; C can't ask again (the dialog says why; the rules refuse a direct write)
    await a.eval(() => window.__GREC.appsD()); await a.step(2);
    assert.ok((await opts(a)).some((x) => /^Carim · Lv \d+$/.test(x)));
    await pick(a, /Carim/); await a.step(2);
    await opts(a); await pick(a, /Turn Carim down/);
    await until([a], () => !window.__GREC.apps().gRcC3 && window.__fakeRTDB.data.has('guildRej/g_gRcA1/gRcC3'));
    assert.equal(await direct(c, 'gRcC3', 'Carim'), 'no', 'turned down: not again this week');
    await c.eval(() => window.__G.advance()); await c.step(2);
    await c.eval((gid) => window.__GREC.apply(gid), GID); await c.step(2);
    await until([c], () => /turned you down\. You can ask again in a week/.test(document.getElementById('dialog').textContent));

    // A invites B from the request: B gets the usual invitation and joins; the request is gone
    await a.eval(() => window.__GREC.appsD()); await a.step(2);
    await opts(a); await pick(a, /Bassem/); await a.step(2);
    await opts(a); await pick(a, /Invite Bassem/);
    await until([b], () => !document.getElementById('guildInv').hidden);
    await b.eval(() => document.querySelector('#guildInv [data-act="gdYes"]').click());
    await until([b], () => { const s = window.__GG.state(); return !!s && s.rank === 'r'; });
    await until([a], () => !window.__GREC.apps().gRcB2 && !window.__fakeRTDB.data.has('guildApply/g_gRcA1/gRcB2'));

    // A stops recruiting: the list is empty again
    await a.eval(() => window.__GREC.stop());
    await until([a], () => !window.__fakeRTDB.data.has('guildRecruit/g_gRcA1'));
    await c.eval(() => window.__G.advance()); await c.step(2);
    await c.eval(() => window.__GREC.list()); await c.step(2);
    await until([c], () => /Recruiting \(0\)/.test(document.getElementById('dialog').textContent));
    await opts(c);
    assert.match(await text(c), /No guild is recruiting right now/);
    for (const g of [a, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/guildApply closed/.test(x))), []);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
