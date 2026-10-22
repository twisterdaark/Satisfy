'use strict';
// SAT-ONLINE-096 (plan U225) over the fake Firebase with the rules' checks: repair orders for player smiths. Ahmed posts an
// order to mend a worn piece for a fee (it leaves his bag); a player who is not a smith sees no work; Bassem the
// Blacksmith mends it: the order goes, Ahmed's piece is mended in his bag (the same piece, the same id) and he is told,
// and Bassem collects the fee once. An order taken off gives its fee back. The rules: nobody mends their own order, takes
// one off without telling its owner, or pays themselves without mending it, or for another fee, or collects a fee twice.
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
async function opts(g) {
  for (let i = 0; i < 4 && await g.eval(() => document.getElementById('dopts').hidden); i++) { await g.eval(() => window.__G.advance()); await g.step(2); }
  return g.eval(() => [...document.querySelectorAll('#dopts button')].map((x) => x.textContent.replace(/^\d+\.\s*/, '')));
}
const pick = async (g, re) => { await opts(g); await g.eval((src) => { const r = new RegExp(src); [...document.querySelectorAll('#dopts button')].find((x) => r.test(x.textContent)).click(); }, re.source); await g.step(2); };
const write = (g, u) => g.eval(async (x) => { const F = window.__GLD.fb(), D = F.m.database; for (const k in x) if (x[k] && x[k].t === 'SV') x[k].t = D.serverTimestamp(); try { await D.update(D.ref(F.db), x); return 'ok'; } catch (e) { return 'no'; } }, u);
// a worn armour piece of a kind every client knows, with its stable id
const wornItem = (g) => g.eval(() => {
  const G = window.__G, S = G.S, rc = Satisfy.local.defs().RC.find((r) => r.slot && r.slot !== 'w' && r.def);
  const it = { uid: ++S.uid, id: rc.id, slot: rc.slot, r: 2, dur: 30, def: 7 };
  S.items.push(it); Satisfy.ids.ensure(S); return S.items[S.items.length - 1].iid;
});
const orders = (g) => g.eval(() => [...window.__fakeRTDB.data.keys()].filter((k) => /^repairOrders\//.test(k)).map((k) => k.split('/')[1]));

test('repair orders: posted with a fee, mended by a player smith in the owner\'s bag, the fee collected once', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gRpA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gRpB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const c = await signIn(ctx, 'c', 'gRpC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    for (const g of [a, b, c]) await g.eval(() => { window.__G.S.gold = 5000; });
    await b.eval(() => { window.__G.S.cls = 'smith'; });
    const iid = await wornItem(a);
    await settle(a, b, c);

    // Ahmed posts an order at the smith's: the piece, then a fee (the middle one); it leaves his bag
    await a.eval(() => window.__GREP.open('smith')); await a.step(3);
    await until([a], () => /Ask a player smith to mend a piece/.test(document.getElementById('dialog').textContent));
    await pick(a, /^(\d+\.\s*)?Post a repair order/);
    const rows = await opts(a);
    assert.ok(rows.some((x) => /\(30%\)$/.test(x)), 'the worn piece: ' + rows.join(' / '));
    await pick(a, /\(30%\)$/);
    const fees = (await opts(a)).filter((x) => /^\d+ gold$/.test(x)).map((x) => parseInt(x, 10));
    assert.equal(fees.length, 3, 'half, three quarters, all: ' + fees);
    const fee = fees[1];
    await pick(a, new RegExp('^(\\d+\\.\\s*)?' + fee + ' gold$'));
    await until([a], () => /Your repair order is up for the smiths/.test(window.__toastSeen));
    assert.equal(await a.eval(() => window.__G.S.gold), 5000 - fee);
    const [oid] = await orders(a);
    assert.match(oid, /^r_/);
    assert.equal(await a.eval(() => window.__G.S.rord.length), 1);

    // Carim is no smith: no work for him; Bassem is: he mends it
    await c.eval(() => window.__GREP.open('smith')); await c.step(3);
    await until([c], () => !document.getElementById('dopts').hidden || /player smith/.test(document.getElementById('dialog').textContent));
    assert.ok(!(await opts(c)).some((x) => /^Mend /.test(x)), 'no work for a non-smith');
    // the rules: nobody mends their own order, takes it off without telling its owner, or pays themselves for nothing
    assert.equal(await write(a, { ['repairOrders/' + oid]: null, ['repairDone/gRpA1/' + oid]: { iid, by: 'gRpA1', sn: 'Ahmed', fee, t: 'SV' }, ['repairPaid/gRpA1/' + oid]: { g: fee, t: 'SV' } }), 'no', 'not your own');
    assert.equal(await write(c, { ['repairOrders/' + oid]: null }), 'no', 'not without telling its owner');
    assert.equal(await write(c, { ['repairPaid/gRpC3/' + oid]: { g: fee, t: 'SV' } }), 'no', 'no pay without mending');
    assert.equal(await write(c, { ['repairOrders/' + oid]: null, ['repairDone/gRpA1/' + oid]: { iid, by: 'gRpC3', sn: 'Carim', fee: fee + 1, t: 'SV' }, ['repairPaid/gRpC3/' + oid]: { g: fee + 1, t: 'SV' } }), 'no', 'not another fee');

    await b.eval(() => window.__GREP.open('smith')); await b.step(3);
    await pick(b, new RegExp("Mend Ahmed's .+ \\(30%\\) for " + fee + ' gold'));
    await until([b], () => /You mended Ahmed's/.test(window.__toastSeen));
    assert.deepEqual(await orders(b), []);

    // Ahmed's piece is mended in his bag, the same piece; he is told
    await until([a], (x) => { const i = window.__G.S.items.find((y) => y.iid === x); return !!i && i.dur === 100; }, 10000, iid);
    await until([a], () => /Bassem mended your/.test(window.__toastSeen));
    assert.equal(await a.eval((x) => window.__G.S.items.filter((y) => y.iid === x).length, iid), 1, 'one piece, its id kept');
    assert.equal(await a.eval(() => window.__G.S.rord.length), 0);
    await until([a], () => ![...window.__fakeRTDB.data.keys()].some((k) => /^repairDone\//.test(k)));

    // Bassem collects the fee once
    await b.eval(() => window.__GREP.open('smith')); await b.step(3);
    const g0 = await b.eval(() => window.__G.S.gold);
    await pick(b, new RegExp('Collect your pay\\s*\\(?' + fee)); // the price shows as a badge
    await until([b], (x) => window.__G.S.gold === x, 10000, g0 + fee);
    await until([b], () => ![...window.__fakeRTDB.data.keys()].some((k) => /^repairPaid\//.test(k)));
    assert.equal(await write(b, { ['repairPaid/gRpB2/' + oid]: null }), 'no', 'collected once: a second page of the account gets nothing');

    // an order taken off gives its fee back
    await wornItem(a);
    await a.eval(() => window.__GREP.open('smith')); await a.step(3);
    await pick(a, /^(\d+\.\s*)?Post a repair order/); await pick(a, /\(30%\)$/);
    const f2 = (await opts(a)).filter((x) => /^\d+ gold$/.test(x)).map((x) => parseInt(x, 10))[0];
    await pick(a, new RegExp('^(\\d+\\.\\s*)?' + f2 + ' gold$'));
    await until([a], () => window.__G.S.rord.length === 1 && !window.__GREP.busy && [...window.__fakeRTDB.data.keys()].some((k) => /^repairOrders\//.test(k)));
    const gA = await a.eval(() => window.__G.S.gold);
    await a.eval(() => window.__GREP.open('smith')); await a.step(3);
    await pick(a, /Take the order off/);
    await until([a], (x) => window.__G.S.gold === x && window.__G.S.rord.length === 0, 10000, gA + f2);
    assert.deepEqual(await orders(a), []);
    for (const g of [a, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/repair/.test(x))), []);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
