'use strict';
// SAT-ONLINE-094 (plan U213/U214) over the fake Firebase with the rules' checks: signed in, the auction house is one board.
// Ahmed lists mithril; Bassem and Carim see it (cheapest first, searchable); both try to buy it at once and only one gets
// it; Ahmed is told, collects the price less the 5% fee, once; a listing withdrawn goes back to the bag and off the board.
// The rules: no taking a listing without paying its price to its seller, no buying your own, the seller's gold is theirs.
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
    assert.match(lid, /^a_/);
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

    // a listing withdrawn goes back to the bag and off everyone's board
    await list(a, 'mith', 2, 500);
    await until([a, b], () => Object.keys(window.__GAU.on).length === 1);
    const lid2 = await a.eval(() => Object.keys(window.__GAU.on)[0]);
    await a.eval(() => document.querySelector('#auW [data-autab="mine"]').click());
    assert.ok((await rows(a)).some((r) => /2× Mithril/.test(r)));
    await a.eval((id) => document.querySelector('#auL [data-aul="' + id + '"]').click(), lid2);
    await until([a, b], () => Object.keys(window.__GAU.on).length === 0);
    assert.equal(await a.eval(() => window.__G.S.mats.mith), 8);
    for (const g of [a, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/auction/.test(x))), []);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
