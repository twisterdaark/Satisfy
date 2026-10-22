'use strict';
// SAT-ONLINE-121 over the fake Firebase with the rules' checks: the game's owner switches world chat, trading and duels off
// and on for everyone from the chat ("/switch chat off why"); every player is told; the page says so before sending, and the
// rules refuse a new world line, trade or duel challenge anyway (a page that doesn't know the switch); nobody else can switch.
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
const ALL = [['gSwM1', 'Owner', true], ['gSwA2', 'Ahmed', false], ['gSwB3', 'Bassem', false]];
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n, all]) => { const D = window.__fakeRTDB.data; for (const [x, y, adm] of all) { D.set('accountIds/' + x, y); D.set('handles/' + y.toLowerCase(), x); if (adm) D.set('admins/' + x, true); } window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name, ALL]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  await g.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
  return g;
}
async function type(g, text) {
  await g.page.keyboard.press('Enter'); await g.step(1);
  await g.page.keyboard.type(text); await g.page.keyboard.press('Enter'); await g.step(2);
}
const toasts = (g) => g.eval(() => window.__toastSeen || '');
const write = (g, p, v) => g.eval(async ([path, x]) => { const F = window.__GLD.fb(), D = F.m.database; try { await D.update(D.ref(F.db), { [path]: x }); return 'ok'; } catch (e) { return 'no'; } }, [p, v]);
const SV = { '.sv': 'timestamp' };
const lines = (g) => g.eval(() => [...window.__fakeRTDB.data].filter(([k]) => /^chat\/satisfy\//.test(k)).map(([, v]) => v.text));

test('live switches: the owner turns world chat, trading and duels off and on for everyone; the rules hold them', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const m = await signIn(ctx, 'm', 'gSwM1', 'Owner', { n: 'Boss', hair: 1, hc: 2, skin: 1, top: 3 });
    const a = await signIn(ctx, 'a', 'gSwA2', 'Ahmed', { n: 'Grid', hair: 3, hc: 0, skin: 2, top: 1 });
    const b = await signIn(ctx, 'b', 'gSwB3', 'Bassem', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(m, a, b);

    // the list, then world chat off with a reason
    await type(m, '/switch'); await m.step(2);
    await until([m], () => /Switches: World chat: on · Trading: on · Dueling: on/.test(document.getElementById('dialog').textContent));
    await m.eval(() => window.__G.advance()); await m.step(2);
    await type(m, '/switch chat off spam wave');
    await until([m], () => /World chat is off for every player/.test(window.__toastSeen));
    const f = await m.eval(() => window.__fakeRTDB.data.get('flags/chat'));
    assert.deepEqual([f.on, f.why, f.by], [false, 'spam wave', 'gSwM1']);
    await until([a], () => /The game's owner switched World chat off for now \(spam wave\)/.test(window.__toastSeen));

    // A's page says so and sends nothing; a page that doesn't know the switch is refused by the rules
    const before = (await lines(a)).length;
    await type(a, '/a hello everyone');
    await until([a], () => /World chat is switched off by the game's owner for now \(spam wave\)/.test(window.__toastSeen));
    assert.equal((await lines(a)).length, before);
    assert.equal(await write(a, 'chat/satisfy/x1', { from: 'gSwA2', h: 'Ahmed', text: 'hi', t: SV }), 'no');

    // nobody else switches
    assert.equal(await write(a, 'flags/chat', { on: true, by: 'gSwA2', t: SV }), 'no');
    await type(a, '/switch chat on');
    await until([a], () => /Only the game's owner/.test(window.__toastSeen));
    assert.equal(await write(m, 'flags/pvp', { on: false, by: 'gSwM1', t: SV }), 'no', 'only the three switches');

    // trading and duels off: the card says so, the rules refuse a new trade and a challenge
    await type(m, '/switch trade off');
    await type(m, '/switch duel off');
    await until([b], () => window.__GSW.on('trade') === false && window.__GSW.on('duel') === false);
    await b.eval(() => { const r = Satisfy.local.net().remotes.find((x) => x.uid === 'gSwA2'); window.__G.P.x = r.x - 16; window.__G.P.y = r.y; });
    await b.step(3); await b.page.keyboard.press('KeyT'); await b.step(2);
    await b.eval(() => document.querySelector('#pctx [data-act="pcTrade"]').click()); await b.step(2);
    await until([b], () => /Trading is switched off by the game's owner for now/.test(window.__toastSeen));
    await b.page.keyboard.press('KeyT'); await b.step(2);
    await b.eval(() => document.querySelector('#pctx [data-act="pcDuel"]').click()); await b.step(2);
    await until([b], () => /Dueling is switched off by the game's owner for now/.test(window.__toastSeen));
    const msg = (type, payload) => ({ from: 'gSwB3', sid: 'sess1234abcd', seq: 1, type, payload, t: SV });
    assert.equal(await write(b, 'inbox/gSwA2/m1', msg('trade.ask', { to: 'gSwA2', trade: 't_gSwB3_1' })), 'no', 'no new trade');
    assert.equal(await write(b, 'trades/t_gSwB3_1', { a: 'gSwB3', b: 'gSwA2', t: SV }), 'no');
    assert.equal(await write(b, 'inbox/gSwA2/m2', msg('duel.challenge', { to: 'gSwA2', duel: 'd_x1' })), 'no', 'no new challenge');
    assert.equal(await write(b, 'inbox/gSwA2/m3', msg('party.invite', { to: 'gSwA2', party: 'p_gSwB3' })), 'ok', 'the rest of the inbox works');

    // back on: everyone is told, and the world line goes out
    await type(m, '/switch chat on');
    await until([a], () => /World chat is back on/.test(window.__toastSeen));
    await type(a, '/a hello again');
    await until([a], () => [...window.__fakeRTDB.data].some(([k, v]) => /^chat\/satisfy\//.test(k) && v.text === 'hello again'));
    const want = /switched off|flags admins only|PERMISSION_DENIED: flags/;
    for (const g of [m, a, b]) assert.deepEqual(await g.eval((src) => window.__fakeRTDB.rejected.filter((x) => !new RegExp(src).test(x)), want.source), []);
    for (const g of [m, a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
