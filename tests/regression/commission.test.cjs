'use strict';
// SAT-ONLINE-098 (plan U219) over the fake Firebase with the rules' checks: crafting commissions. Ahmed commissions an
// Iron Sword: its materials and the fee leave his bag. Bassem knows the recipe and forges it from the order's materials,
// not his own; the sword goes to Ahmed "Made by" Bassem, Bassem keeps nothing of it and collects the fee once. An order
// taken off gives back the materials and the fee; a piece forged for an order taken off meanwhile goes back to the forge.
// The rules: no piece without an order, for another recipe or fee, or for yourself; no pay without the piece.
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
const orders = (g) => g.eval(() => [...window.__fakeRTDB.data.keys()].filter((k) => /^craftOrders\//.test(k)).map((k) => k.split('/')[1]));
const swords = (g) => g.eval(() => window.__G.S.items.filter((i) => i.id === 'isword').map((i) => ({ by: i.by || null, iid: i.iid })));
async function commission(a) {
  await a.eval(() => window.__GCOM.open('smith')); await a.step(3);
  await pick(a, /^(\d+\.\s*)?Commission a piece/);
  await pick(a, /Iron Sword/);
  await pick(a, /^(\d+\.\s*)?500(\s*gold)?$/);
  await until([a], () => window.__G.S.cord.length >= 1 && !window.__GCOM.busy && [...window.__fakeRTDB.data.keys()].some((k) => /^craftOrders\//.test(k)));
}

test('crafting commissions: materials and fee up front, forged by a player crafter, "Made by" them, paid once', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gCmA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gCmB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const c = await signIn(ctx, 'c', 'gCmC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    for (const g of [a, b, c]) await g.eval(() => { const S = window.__G.S; S.gold = 5000; S.mats.ore = 12; S.mats.wood = 3; });
    await b.eval(() => { window.__G.S.rcK.isword = 1; });
    const swords0 = (await swords(a)).length;
    await settle(a, b, c);

    // Ahmed commissions an Iron Sword for 500: the materials (5 ore, 1 wood) and the fee leave his bag
    await commission(a);
    assert.deepEqual(await a.eval(() => ({ gold: window.__G.S.gold, ore: window.__G.S.mats.ore, wood: window.__G.S.mats.wood })), { gold: 4500, ore: 7, wood: 2 });
    const [cid] = await orders(a);
    assert.match(cid, /^c_/);
    assert.equal(await a.eval((x) => window.__fakeRTDB.data.get('craftOrders/' + x).rc, cid), 'isword');

    // the rules: no piece for yourself, without its order's recipe and fee, and no pay without the piece
    const piece = JSON.stringify({ id: 'isword', slot: 'w', r: 4, atk: 999, dur: 100 });
    assert.equal(await write(a, { ['craftOrders/' + cid]: null, ['craftDone/gCmA1/' + cid]: { it: piece, id: 'isword', by: 'gCmA1', bn: 'Ahmed', fee: 500, t: 'SV' }, ['craftPaid/gCmA1/' + cid]: { g: 500, t: 'SV' } }), 'no', 'not for yourself');
    assert.equal(await write(c, { ['craftOrders/' + cid]: null, ['craftDone/gCmA1/' + cid]: { it: piece, id: 'gsword', by: 'gCmC3', bn: 'Carim', fee: 500, t: 'SV' }, ['craftPaid/gCmC3/' + cid]: { g: 500, t: 'SV' } }), 'no', 'not another recipe');
    assert.equal(await write(c, { ['craftOrders/' + cid]: null, ['craftDone/gCmA1/' + cid]: { it: piece, id: 'isword', by: 'gCmC3', bn: 'Carim', fee: 5000, t: 'SV' }, ['craftPaid/gCmC3/' + cid]: { g: 5000, t: 'SV' } }), 'no', 'not another fee');
    assert.equal(await write(c, { ['craftPaid/gCmC3/' + cid]: { g: 500, t: 'SV' } }), 'no', 'no pay without the piece');
    assert.equal(await write(c, { ['craftOrders/' + cid]: null }), 'no', 'not off without its poster told');

    // Carim doesn't know the recipe: no work for him; Bassem does: he forges it from the order's materials
    await c.eval(() => window.__GCOM.open('smith')); await c.step(3);
    assert.ok(!(await opts(c)).some((x) => /^Make /.test(x)), 'no work without the recipe');
    await b.eval(() => window.__GCOM.open('smith')); await b.step(3);
    await pick(b, /Make Iron Sword for Ahmed for 500/);
    assert.equal(await b.eval(() => window.__G.mode), 'forge');
    await b.eval(() => window.__G.finishMG()());
    await until([b], () => /Your Iron Sword went to Ahmed/.test(window.__toastSeen));
    assert.deepEqual(await b.eval(() => ({ ore: window.__G.S.mats.ore, wood: window.__G.S.mats.wood })), { ore: 12, wood: 3 }, "the crafter's own materials untouched");
    assert.equal((await swords(b)).length, 0, 'the crafter keeps nothing of it');

    // Ahmed has it, "Made by" Bassem; told once
    await until([a], (n) => window.__G.S.items.filter((i) => i.id === 'isword').length === n, 10000, swords0 + 1);
    const got = (await swords(a)).find((x) => x.by === 'Bassem');
    assert.ok(got, 'Made by Bassem: ' + JSON.stringify(await swords(a)));
    assert.match(got.iid, /^it_/);
    await until([a], () => /Bassem made your Iron Sword/.test(window.__toastSeen));
    assert.equal(await a.eval(() => window.__G.S.cord.length), 0);

    // Bassem collects the fee once
    await b.eval(() => { const G = window.__G; if (G.mode !== 'play') { document.getElementById('forge').hidden = true; } });
    await b.eval(() => window.__GCOM.open('smith')); await b.step(3);
    const g0 = await b.eval(() => window.__G.S.gold);
    await pick(b, /Collect your pay/);
    await until([b], (x) => window.__G.S.gold === x, 10000, g0 + 500);
    await until([b], () => ![...window.__fakeRTDB.data.keys()].some((k) => /^craftPaid\//.test(k)));
    assert.equal(await write(b, { ['craftPaid/gCmB2/' + cid]: null }), 'no', 'collected once: a second page of the account gets nothing');

    // an order taken off: materials and fee back. One taken off while it is forged: the piece goes back to the forge
    await commission(a);
    const before = await a.eval(() => ({ gold: window.__G.S.gold, ore: window.__G.S.mats.ore }));
    await a.eval(() => window.__GCOM.open('smith')); await a.step(3);
    await pick(a, /Take the order off/);
    await until([a], (x) => window.__G.S.gold === x.gold + 500 && window.__G.S.mats.ore === x.ore + 5 && window.__G.S.cord.length === 0, 10000, before);
    await commission(a);
    await b.eval(() => window.__GCOM.open('smith')); await b.step(3);
    await pick(b, /Make Iron Sword for Ahmed for 500/);
    await a.eval(() => window.__GCOM.open('smith')); await a.step(3);
    await pick(a, /Take the order off/);
    await until([a], () => window.__G.S.cord.length === 0 && !window.__GCOM.busy);
    await settle(a, b);
    await b.eval(() => window.__G.finishMG()());
    await until([b], () => /That order was taken off, so the piece went back to the forge/.test(window.__toastSeen));
    assert.equal((await swords(b)).length, 0);
    for (const g of [a, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/craft/.test(x))), []);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
