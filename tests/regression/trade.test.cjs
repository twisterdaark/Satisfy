'use strict';
// SAT-ONLINE-039 (owner 2026-10-19): trading without a server, online over the fake Firebase. Each side puts in gold and
// bag items, both Accept, then Confirm; any change resets the accepts; the swap is one database update keyed by the item
// ids, so the same item can't be traded twice (an old save that still has it is refused).
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
const shown = (g, id) => g.eval((i) => !document.getElementById(i).hidden, id);
const click = (g, sel) => g.eval((s) => document.querySelector(s).click(), sel);
const text = (g, id) => g.eval((i) => document.getElementById(i).textContent, id);
// the card of the player next to you: T where it exists, else a click on their name
async function openCard(g, uid) {
  await g.page.keyboard.press('KeyT'); await g.step(2);
  if (!(await shown(g, 'pctx'))) {
    const p = await g.eval((u) => { const r = Satisfy.local.net().remotes.find((x) => x.uid === u); return window.__G.toScreen(r.x, r.y - 30); }, uid);
    await g.page.mouse.click(p.x, p.y); await g.step(2);
  }
  assert.equal(await shown(g, 'pctx'), true, 'the card is open');
}
async function setGold(g, n) { await g.eval((v) => { const i = document.getElementById('trGold'); i.value = String(v); i.dispatchEvent(new Event('change')); }, n); await g.step(2); }
// a bag item of a kind every client knows (a crafted armour piece), with its stable id
const giveItem = (g) => g.eval(() => {
  const G = window.__G, S = G.S, rc = Satisfy.local.defs().RC.find((r) => r.slot && r.slot !== 'w' && r.def);
  const it = { uid: ++S.uid, id: rc.id, slot: rc.slot, r: 2, dur: 100, def: 7 };
  S.items.push(it); Satisfy.ids.ensure(S); return JSON.parse(JSON.stringify(it));
});

test('online: offer, any change resets the accepts, Accept + Confirm swap once; the same item again is refused', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const pages = {};
    for (const [k, uid, name] of [['a', 'gTradeA1', 'Ahmed'], ['b', 'gTradeB2', 'Bassem']]) {
      const g = pages[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
    }
    const { a, b } = pages;
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    for (const g of [a, b]) await g.eval(() => { window.__G.S.gold = 500; });
    const it = await giveItem(a);
    await settle(a, b); await settle(a, b);

    // A asks from B's card; B says yes; both windows open
    await openCard(a, 'gTradeB2');
    assert.equal(await shown(a, 'pctxTr'), true, 'Trade on the card online');
    await click(a, '#pctx [data-act="pcTrade"]');
    await until([b], () => !document.getElementById('tradeInv').hidden);
    assert.match(await text(b, 'tradeInvT'), /Ahmed wants to trade/);
    await click(b, '#tradeInv [data-act="trYes"]');
    await until([a, b], () => !document.getElementById('tradeW').hidden);
    assert.match(await text(a, 'trH'), /Trade with Bassem/);
    // the worn weapon is not offered, the new piece is
    const bagA = await a.eval(() => [...document.querySelectorAll('#trBag button')].map((x) => x.dataset.iid));
    assert.ok(bagA.includes(it.iid), 'the piece is in the bag list');
    assert.ok(!bagA.includes(await a.eval(() => window.__G.S.items.find((i) => i.uid === window.__G.S.eqW || i === window.__G.S.items[0]).iid)), 'not the weapon you hold');
    await a.eval((iid) => document.querySelector('#trBag button[data-iid="' + iid + '"]').click(), it.iid);
    await setGold(a, 100);
    await setGold(b, 40);
    await until([b], (iid) => !!document.querySelector('#trTh span[data-iid="' + iid + '"]') && /100 Gold/.test(document.getElementById('trTh').textContent), 8000, it.iid);
    await until([a], () => /40 Gold/.test(document.getElementById('trTh').textContent));
    // Accept, then B changes its offer: A's accept is gone
    assert.equal(await a.eval(() => document.getElementById('trConf').disabled), true, 'Confirm waits for both accepts');
    await click(a, '#trOk'); await settle(a, b);
    assert.equal(await text(a, 'trOk'), 'Accepted ✓');
    await until([b], () => document.getElementById('trThS').textContent === 'Accepted');
    await setGold(b, 50);
    await until([a], () => document.getElementById('trOk').textContent === 'Accept' && /50 Gold/.test(document.getElementById('trTh').textContent));
    // both Accept, both Confirm: one swap
    await click(a, '#trOk'); await click(b, '#trOk'); await settle(a, b);
    await until([a, b], () => !document.getElementById('trConf').disabled);
    await click(a, '#trConf'); await click(b, '#trConf');
    await until([a, b], () => document.getElementById('tradeW').hidden, 15000);
    await settle(a, b);
    assert.match(await text(a, 'toasts'), /Trade with Bassem done/);
    assert.match(await text(b, 'toasts'), /Trade with Ahmed done/);
    assert.equal(await a.eval(() => window.__G.S.gold), 450);
    assert.equal(await b.eval(() => window.__G.S.gold), 550);
    assert.equal(await a.eval((iid) => window.__G.S.items.some((i) => i.iid === iid), it.iid), false, 'A gave it');
    const got = await b.eval((id) => window.__G.S.items.filter((i) => i.id === id && i.r === 2 && i.def === 7).map((i) => i.iid), it.id);
    assert.equal(got.length, 1, 'B has it once');
    assert.notEqual(got[0], it.iid, "it is B's own item now (B's id)");
    assert.deepEqual(await a.eval((iid) => { const v = window.__fakeRTDB.data.get('tradedItems/' + iid); return v && v.o; }, it.iid), 'gTradeB2', 'the ledger');
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);

    // A reloads an old save that still has the piece (same id) and offers it again: the swap is refused
    await a.eval((old) => { window.__G.S.items.push(old); Satisfy.ids.ensure(window.__G.S); }, it);
    await settle(a, b);
    await openCard(a, 'gTradeB2');
    await click(a, '#pctx [data-act="pcTrade"]');
    await until([b], () => !document.getElementById('tradeInv').hidden);
    await click(b, '#tradeInv [data-act="trYes"]');
    await until([a, b], () => !document.getElementById('tradeW').hidden);
    await a.eval((iid) => document.querySelector('#trBag button[data-iid="' + iid + '"]').click(), it.iid);
    await settle(a, b);
    await click(a, '#trOk'); await click(b, '#trOk'); await settle(a, b);
    await until([a, b], () => !document.getElementById('trConf').disabled);
    await click(a, '#trConf'); await click(b, '#trConf');
    await until([a], () => /did not go through/.test(document.getElementById('toasts').textContent), 15000);
    await settle(a, b);
    assert.equal(await a.eval((iid) => window.__G.S.items.filter((i) => i.iid === iid).length, it.iid), 1, 'A still has its copy');
    assert.equal(await b.eval((id) => window.__G.S.items.filter((i) => i.id === id && i.r === 2 && i.def === 7).length, it.id), 1, 'B did not get a second one');
    const rej = [...await a.eval(() => window.__fakeRTDB.rejected), ...await b.eval(() => window.__fakeRTDB.rejected)];
    assert.ok(rej.length >= 1 && rej.every((r) => /tradedItems not the giver/.test(r)), 'refused by the ledger rule: ' + rej);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
