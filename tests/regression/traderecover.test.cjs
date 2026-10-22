'use strict';
// SAT-ONLINE-128 (plan U063, "no side loses anything without getting its part, or a rollback") over the fake Firebase.
// Zed puts a piece in a trade with Ahmed for 300 gold and confirms, then his tab closes before the swap. Ahmed confirms
// and the swap is written. When Zed comes back, his game finds the trade it confirmed, done, and applies it once: the piece
// leaves his bag and the 300 gold come in. A trade Zed confirmed that never went through is forgotten a minute later.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 6; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
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
const keepToasts = (g) => g.eval(() => { window.__toastNew = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) window.__toastNew.push(n.textContent); }).observe(document.getElementById('toasts'), { childList: true }); });
const click = (g, sel) => g.eval((s) => document.querySelector(s).click(), sel);
async function setGold(g, n) { await g.eval((v) => { const i = document.getElementById('trGold'); i.value = String(v); i.dispatchEvent(new Event('change')); }, n); await g.step(2); }
const giveItem = (g) => g.eval(() => {
  const G = window.__G, S = G.S, rc = Satisfy.local.defs().RC.find((r) => r.slot && r.slot !== 'w' && r.def);
  const it = { uid: ++S.uid, id: rc.id, slot: rc.slot, r: 2, dur: 100, def: 7 };
  S.items.push(it); Satisfy.ids.ensure(S); return JSON.parse(JSON.stringify(it));
});
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  return g;
}
// open a trade from A's side to the other player's card, both windows up
async function openTrade(a, z, zUid) {
  await a.page.keyboard.press('KeyT'); await a.step(2);
  await click(a, '#pctx [data-act="pcTrade"]');
  await until([z], () => !document.getElementById('tradeInv').hidden);
  await click(z, '#tradeInv [data-act="trYes"]');
  await until([a, z], () => !document.getElementById('tradeW').hidden);
}

test('a trade confirmed before the tab closed is applied when that player comes back, once', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    // Ahmed's uid is the lower one: he writes the swap as soon as both have confirmed
    const a = await signIn(ctx, 'a', 'gTrcA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const z1 = await signIn(ctx, 'z', 'gTrcZ9', 'Zed', { n: 'Zeddo', hair: 3, hc: 0, skin: 2, top: 1 });
    let z = z1;
    await z.eval(() => { window.__G.P.x += 20; });
    for (const g of [a, z]) await g.eval(() => { window.__G.S.gold = 500; });
    const it = await giveItem(z);
    await settle(a, z); await settle(a, z);

    await openTrade(a, z, 'gTrcZ9');
    await z.eval((iid) => document.querySelector('#trBag button[data-iid="' + iid + '"]').click(), it.iid);
    await setGold(a, 300);
    await until([a], (iid) => !!document.querySelector('#trTh span[data-iid="' + iid + '"]'), 8000, it.iid);
    await until([z], () => /300 Gold/.test(document.getElementById('trTh').textContent));
    await click(a, '#trOk'); await click(z, '#trOk'); await settle(a, z);
    await until([a, z], () => !document.getElementById('trConf').disabled);

    // Zed confirms: the trade is kept in his save; then his tab closes before anything else
    await click(z, '#trConf');
    await until([z], () => !!(window.__GTRR.pend && window.__GTRR.pend.id));
    const tid = await z.eval(() => window.__GTRR.pend.id);
    const aName = await z.eval(() => Satisfy.local.net().remotes.find((r) => r.uid === 'gTrcA1').handle);
    assert.deepEqual(await z.eval(() => { const p = window.__GTRR.pend; return [p.foe, p.n]; }), ['gTrcA1', aName]);
    // Claude-B's note on #164: what he confirmed is held, out of the bag, so he can't sell it and still be paid for it
    assert.deepEqual(await z.eval((iid) => [window.__G.S.items.some((i) => i.iid === iid), window.__GTRR.esc().it.map((i) => i.iid)], it.iid), [false, [it.iid]]);
    assert.ok(await z.eval((iid) => !!document.querySelector('#trBag button[data-iid="' + iid + '"]'), it.iid), 'still his to offer in this trade');
    await z.eval(() => window.__GU.save(true));
    await z.page.close();

    // Ahmed confirms: the swap is written and applied on his side
    await click(a, '#trConf');
    await until([a], (t) => !!window.__fakeRTDB.data.get('tradeDone/' + t), 10000, tid);
    await until([a], () => window.__G.S.gold === 200, 10000);
    assert.equal(await a.eval((id) => window.__G.S.items.some((i) => i.id === id && i.r === 2 && i.def === 7), it.id), true, 'Ahmed has the piece');

    // Zed comes back in a new tab: his game finds the swap it confirmed and applies it, once
    const z2 = await H.openGame({ ctx, query: '?net=online&slot=z' });
    await z2.eval(() => { window.__fakeRTDB.nextName = 'Zed'; window.__fakeRTDB.nextUid = 'gTrcZ9'; document.getElementById('onlineBtn').click(); });
    await until([z2], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
    await keepToasts(z2);
    await H.continueGame(z2);
    z = z2;
    await until([z], () => window.__G.S.gold === 800 && !window.__GTRR.pend, 20000);
    assert.equal(await z.eval((iid) => window.__G.S.items.some((i) => i.iid === iid), it.iid), false, 'the piece left');
    assert.deepEqual(await z.eval(() => window.__GTRR.done), [tid]);
    const zt = await z.eval(() => window.__toastNew);
    assert.ok(zt.some((x) => x.includes('Your trade with ' + aName + ' went through while you were away')), JSON.stringify(zt));
    // looked up again (another tick, the same trade's swap seen late): nothing changes
    await z.eval((t) => { window.__G.S.trPend = { id: t, foe: 'gTrcA1', n: 'Ahmed', t: Date.now() }; window.__GTRR.tick(); }, tid);
    await settle(z);
    assert.equal(await z.eval(() => window.__G.S.gold), 800, 'not twice');
    assert.equal(await z.eval(() => window.__GTRR.pend), undefined);

    // a confirmed trade that was never done: kept while it could still go through, forgotten after a minute
    // (a trade of its own that was asked and confirmed, but Ahmed never confirmed it: there is no swap to find)
    await z.eval(() => { const F = window.__GLD.fb(), D = F.m.database; return D.set(D.ref(F.db, 'trades/t_gTrcZ9_never1'), { a: 'gTrcZ9', b: 'gTrcA1', t: D.serverTimestamp() }); });
    await z.eval(() => { window.__G.S.gold -= 50; window.__G.S.trPend = { id: 't_gTrcZ9_never1', foe: 'gTrcA1', n: 'Ahmed', t: Date.now(), esc: { g: 50, it: [{ id: 'isword', slot: 'w', r: 1, dur: 100, uid: 9901, iid: 'it_held_1' }] } }; window.__GTRR.tick(); });
    await settle(z);
    assert.equal(await z.eval(() => window.__GTRR.pend && window.__GTRR.pend.id), 't_gTrcZ9_never1');
    await z.eval(() => { window.__G.S.trPend.t = Date.now() - 61000; window.__GTRR.tick(); });
    await until([z], () => !window.__GTRR.pend);
    assert.equal(await z.eval(() => window.__G.S.gold), 800, 'the gold it held is back');
    assert.ok(await z.eval(() => window.__G.S.items.some((i) => i.uid === 9901 && i.id === 'isword')), 'and the piece');
    for (const g of [a, z]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(a.errors, []);
    assert.deepEqual(z1.errors, []);
    assert.deepEqual(z2.errors, []);
  } finally { await ctx.close(); }
});
