'use strict';
// SAT-ONLINE-094 (plan U213/U214) over the fake Firebase with the rules' checks: signed in, the auction house is one board.
// Ahmed lists mithril; Bassem and Carim see it (cheapest first, searchable); both try to buy it at once and only one gets
// it; Ahmed is told, collects the price less the 5% fee, once; a listing withdrawn goes back to the bag and off the board.
// The rules: no taking a listing without paying its price to its seller, no buying your own, the seller's gold is theirs
// and collected once; eight listings a seller (slots a_{uid}_0 to _7), up to 999 of a kind for up to a billion gold, bought
// for 14 days, after which the seller's game takes it back (Claude-B's review of #129).
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
const keepToasts = (g) => g.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { const D = window.__fakeRTDB.data; D.set('accountIds/' + u, n); D.set('handles/' + n.toLowerCase(), u); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  await keepToasts(g);
  return g;
}
const rows = (g) => g.eval(() => [...document.querySelectorAll('#auL .aurow')].map((r) => r.textContent));
// move a page's clock on by ms from where it is (its Date.now, which the fake's rules use too)
const later = (g, ms) => g.eval((d) => { if (!window.__now0) { window.__now0 = Date.now; window.__dt = 0; } window.__dt += d; const b = window.__now0; Date.now = () => b() + window.__dt; }, ms);
const write = (g, u) => g.eval(async (x) => { const F = window.__GLD.fb(), D = F.m.database; for (const k in x) if (x[k] && x[k].t === 'SV') x[k].t = D.serverTimestamp(); try { await D.update(D.ref(F.db), x); return 'ok'; } catch (e) { return 'no'; } }, u);
async function list(g, k, n, price) {
  await g.eval(([kk, nn, pp]) => { document.querySelector('#auBag [data-auk="' + kk + '"]').click(); const N = document.getElementById('auN'); N.value = String(nn); N.dispatchEvent(new Event('input')); const P = document.getElementById('auP'); P.value = String(pp); P.dispatchEvent(new Event('input')); document.getElementById('auGo').click(); }, [k, n, price]);
}

test('online auction: one board; one buyer of two gets it; the seller is told and collects once; withdraw', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gAuA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gAuB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const c = await signIn(ctx, 'c', 'gAuC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    for (const g of [a, b, c]) await g.eval(() => { const S = window.__G.S; S.gold = 5000; S.mats.mith = 12; });
    await settle(a, b, c);

    // Ahmed lists 4 mithril for 999: off his bag, on the board for everyone
    await a.eval(() => window.__G.talkNPC('auction')); await a.step(2);
    assert.equal(await a.mode(), 'au');
    await list(a, 'mith', 4, 999);
    await until([a], () => Object.keys(window.__GAU.on).length === 1);
    assert.equal(await a.eval(() => window.__G.S.mats.mith), 8);
    const lid = await a.eval(() => Object.keys(window.__GAU.on)[0]);
    assert.equal(lid, 'a_gAuA1_0', "the first of Ahmed's eight slots");
    // the rules: no listing outside your own eight slots
    const L = { by: 'gAuA1', n: 'Ahmed', it: 'mith', q: 1, price: 10, t: 'SV' };
    assert.equal(await write(a, { 'auction/a_gAuA1_8': L }), 'no', 'no ninth slot');
    assert.equal(await write(a, { 'auction/a_gAuB2_1': L }), 'no', "not in another's slot");
    assert.equal(await write(a, { 'auction/a_gAuA1_x9': L }), 'no', 'slots only');
    for (const g of [b, c]) { await g.eval(() => window.__G.talkNPC('auction')); await g.step(2); }
    await until([b, c], (id) => !!document.querySelector('#auL [data-aul="' + id + '"]'), 10000, lid);
    assert.ok((await rows(b)).some((r) => /4× Mithril/.test(r) && /Ahmed/.test(r) && /999/.test(r)), 'on Bassem\'s board: ' + (await rows(b)).join(' / '));
    // searchable: a word that matches nothing hides it
    await b.eval(() => { const q = document.getElementById('auQ'); q.value = 'zzz'; q.dispatchEvent(new Event('input')); });
    assert.equal(await b.eval((id) => !!document.querySelector('#auL [data-aul="' + id + '"]'), lid), false);
    await b.eval(() => { const q = document.getElementById('auQ'); q.value = 'mith'; q.dispatchEvent(new Event('input')); });
    assert.equal(await b.eval((id) => !!document.querySelector('#auL [data-aul="' + id + '"]'), lid), true);

    // the rules: nobody takes it without paying its price to Ahmed, Ahmed doesn't buy his own
    assert.equal(await write(c, { ['auction/' + lid]: null }), 'no', 'not without paying');
    assert.equal(await write(c, { ['auction/' + lid]: null, ['auctionPaid/gAuA1/' + lid]: { g: 1, by: 'gAuC3', bn: 'Carim', it: 'mith', q: 4, t: 'SV' } }), 'no', 'not for less');
    assert.equal(await write(c, { ['auction/' + lid]: null, ['auctionPaid/gAuC3/' + lid]: { g: 999, by: 'gAuC3', bn: 'Carim', it: 'mith', q: 4, t: 'SV' } }), 'no', 'paid to its seller only');
    assert.equal(await write(a, { ['auction/' + lid]: null, ['auctionPaid/gAuA1/' + lid]: { g: 999, by: 'gAuA1', bn: 'Ahmed', it: 'mith', q: 4, t: 'SV' } }), 'no', 'not your own');

    // both buy at once: one gets it
    await Promise.all([b, c].map((g) => g.eval((id) => document.querySelector('#auL [data-aul="' + id + '"]').click(), lid)));
    await settle(a, b, c);
    await until([b, c], () => !window.__fakeRTDB.data.has('auction/' + Object.keys(window.__GAU.on)[0]) || Object.keys(window.__GAU.on).length === 0);
    const got = await Promise.all([b, c].map((g) => g.eval(() => ({ mith: window.__G.S.mats.mith, gold: window.__G.S.gold }))));
    assert.deepEqual(got.map((x) => x.mith).sort(), [12, 16], 'one of them has the 4');
    assert.deepEqual(got.map((x) => x.gold).sort(), [4001, 5000], 'and paid 999 once');
    const lost = got[0].mith === 12 ? b : c;
    await until([lost], () => /That has already been sold/.test(window.__toastSeen));

    // Ahmed is told and collects 949 (999 less 5%), once
    await until([a], () => Object.keys(window.__GAU.paid).length === 1);
    await until([a], () => /bought your 4× Mithril for 949 gold/.test(window.__toastSeen));
    await until([a], () => /949/.test(document.getElementById('auC').textContent));
    const g0 = await a.eval(() => window.__G.S.gold);
    await a.eval(() => document.getElementById('auCol').click());
    await until([a], () => Object.keys(window.__GAU.paid).length === 0);
    assert.equal(await a.eval(() => window.__G.S.gold), g0 + 949);
    assert.equal(await write(b, { ['auctionPaid/gAuA1/' + lid]: null }), 'no', "the seller's gold is the seller's");
    assert.equal(await write(a, { ['auctionPaid/gAuA1/' + lid]: null }), 'no', 'collected once: a second page of the account gets nothing');

    // a listing withdrawn goes back to the bag and off everyone's board
    await list(a, 'mith', 2, 500);
    await until([a, b], () => Object.keys(window.__GAU.on).length === 1);
    const lid2 = await a.eval(() => Object.keys(window.__GAU.on)[0]);
    await a.eval(() => document.querySelector('#auW [data-autab="mine"]').click());
    assert.ok((await rows(a)).some((r) => /2× Mithril/.test(r)));
    await a.eval((id) => document.querySelector('#auL [data-aul="' + id + '"]').click(), lid2);
    await until([a, b], () => Object.keys(window.__GAU.on).length === 0);
    assert.equal(await a.eval(() => window.__G.S.mats.mith), 8);

    // the most the rules take: 1500 asked lists 999, two billion gold lists a billion; the board takes it
    await a.eval(() => { window.__G.S.mats.mith = 1500; window.__G.renderAu && window.__G.renderAu(); });
    await a.eval(() => document.querySelector('#auW [data-autab="list"]').click());
    await list(a, 'mith', 1500, 2e9);
    await until([a, b], () => Object.keys(window.__GAU.on).length === 1);
    const big = await a.eval(() => Object.values(window.__GAU.on)[0]);
    assert.deepEqual([big.q, big.price], [999, 1e9]);
    assert.equal(await a.eval(() => window.__G.S.mats.mith), 501);

    // 14 days on: nobody can buy it (the rules refuse it too), and it comes back to Ahmed
    for (const g of [a, b]) await later(g, 15 * 864e5);
    await b.eval(() => { window.__G.S.gold = 2e9; });
    assert.equal(await write(b, { ['auction/' + big.id]: null, ['auctionPaid/gAuA1/' + big.id]: { g: 1e9, by: 'gAuB2', bn: 'Bassem', it: 'mith', q: 999, t: 'SV' } }), 'no', 'not after 14 days');
    await b.eval(() => document.querySelector('#auW [data-autab="list"]').click());
    assert.equal(await b.eval((id) => !!document.querySelector('#auL [data-aul="' + id + '"]'), big.id), false, 'off the board');
    await a.eval(() => document.querySelector('#auW [data-autab="mine"]').click());
    await until([a], () => /did not sell in 14 days and came back/.test(window.__toastSeen));
    await until([a, b], () => Object.keys(window.__GAU.on).length === 0);
    assert.equal(await a.eval(() => window.__G.S.mats.mith), 1500);
    for (const g of [a, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/auction/.test(x))), []);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
