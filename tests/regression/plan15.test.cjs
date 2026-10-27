'use strict';
// v3.64 (plan U219) crafting commissions over the fake Firebase with the rules' checks. Ahmed orders an Iron Sword at the
// smithy: the fee and the sword's materials leave his bag. Carim is no smith and sees no work. Bassem the Blacksmith knows
// the recipe: he claims the order and forges it with the order's materials (none of his own); while he works Ahmed can't
// take it off. The sword arrives in Ahmed's bag with Bassem's mark, and Bassem collects the fee once. An order nobody holds
// is taken off with its fee and materials back. A piece that comes broken (a changed client's) is the ordered one, plain:
// an answered order is never refunded. An order the server never got is taken off at once.
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
const board = async (g, re) => { await g.eval(() => window.__GCOM.open('smith')); await g.step(3); await until([g], (s) => new RegExp(s).test(document.getElementById('dialog').textContent), 10000, re.source); };
const orders = (g) => g.eval(() => [...window.__fakeRTDB.data.keys()].filter((k) => /^comm(Orders|Claim|Done|Paid)\//.test(k)));
const swords = (g) => g.eval(() => window.__G.S.items.filter((i) => i.id === 'isword').length);

test('a commission: ordered with its fee and materials, forged by a player smith with the order\'s, the piece to its owner, the fee collected once', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gCmA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gCmB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const c = await signIn(ctx, 'c', 'gCmC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    for (const g of [a, b, c]) await g.eval(() => { const S = window.__G.S; S.gold = 5000; S.mats = {}; });
    await a.eval(() => { const S = window.__G.S; S.mats.ore = 5; S.mats.wood = 1; });
    await b.eval(() => { const S = window.__G.S; S.cls = 'smith'; S.rcK.isword = 1; });
    await c.eval(() => { window.__G.S.rcK.isword = 1; });
    await settle(a, b, c);
    const name = await a.eval(() => window.__G.lines().en.isword);
    const sw0 = { a: await swords(a), b: await swords(b) };
    assert.ok(await a.eval(() => window.__GCOM.can().includes('isword')), 'Ahmed can order the sword');

    // Ahmed orders the sword at the smithy: the piece (he has its materials), then a fee (the first: 600)
    await board(a, /Order a piece forged by a player smith/);
    await pick(a, /^(\d+\.\s*)?Order a piece$/);
    const rows = await opts(a);
    assert.ok(rows.some((x) => x.startsWith(name + ' (')), 'the sword, with its materials: ' + rows.join(' / '));
    await pick(a, new RegExp('^(\\d+\\.\\s*)?' + name + ' \\('));
    const fees = (await opts(a)).filter((x) => /^\d+ gold$/.test(x)).map((x) => parseInt(x, 10));
    assert.deepEqual(fees, [600, 1200, 2400], 'by the piece: ' + fees);
    await pick(a, /^(\d+\.\s*)?600 gold$/);
    await until([a], () => /Your order is up for the smiths/.test(window.__toastSeen));
    assert.deepEqual(await a.eval(() => { const S = window.__G.S; return [S.gold, S.mats.ore | 0, S.mats.wood | 0, S.cord.length]; }), [4400, 0, 0, 1], 'the fee and the materials are in the order');
    const keys = await orders(a);
    assert.equal(keys.length, 1); assert.match(keys[0], /^commOrders\/c_/);
    const oid = keys[0].split('/')[1];

    // Carim is no smith: no work for him
    await board(c, /Order a piece forged/);
    assert.ok(!(await opts(c)).some((x) => /^Forge /.test(x)), 'no work for a non-smith');
    await c.eval(() => window.__G.closeDialog && window.__G.closeDialog());

    // Bassem is: he takes it, and the forge opens with the order's materials (none of his own taken)
    await board(b, /Work for smiths \(1\)/);
    const work = (await opts(b)).filter((x) => /^Forge /.test(x));
    assert.deepEqual(work, ['Forge ' + name + ' for Ahmed for 600 gold']);
    await pick(b, /^(\d+\.\s*)?Forge /);
    await until([b], () => window.__G.mode === 'forge' && !!window.__G.MG && !!window.__GCOM.job);
    assert.deepEqual(await b.eval(() => [window.__G.S.mats.ore | 0, window.__G.S.mats.wood | 0]), [0, 0]);
    assert.ok((await orders(b)).includes('commClaim/' + oid), 'his claim');

    // while he works, Ahmed can't take the order off
    await settle(a, b);
    await board(a, /Order a piece forged/);
    const mine = (await opts(a)).find((x) => x.startsWith(name + ' · '));
    assert.match(mine, /a smith is at work$/);
    await pick(a, new RegExp('^(\\d+\\.\\s*)?' + name + ' · '));
    await until([a], () => /A smith is at work on that order/.test(window.__toastSeen));
    assert.equal(await a.eval(() => window.__G.S.cord.length), 1);

    // Bassem finishes: the sword isn't his; the order, his claim, the piece for Ahmed and his pay go in one write
    await b.eval(() => window.__GCOM.forgeNow());
    await until([b], () => /You forged .* for Ahmed/.test(window.__toastSeen));
    assert.equal(await swords(b), sw0.b, 'not in the smith\'s bag');
    await until([a], () => /Faker forged your/.test(window.__toastSeen) || /Bassem forged your/.test(window.__toastSeen), 15000);
    const got = await a.eval(() => { const S = window.__G.S, it = S.items.filter((i) => i.id === 'isword').pop(); return { n: S.items.filter((i) => i.id === 'isword').length, by: it.by, cord: S.cord.length, r: it.r, trd: it.trd }; });
    assert.equal(got.n, sw0.a + 1, 'the sword arrived');
    assert.equal(got.by, 'Faker', 'with the smith\'s mark');
    assert.equal(got.cord, 0);
    assert.ok(got.r >= 0 && got.r <= 4);
    await settle(a, b);
    assert.deepEqual((await orders(a)).filter((k) => !/^commPaid\//.test(k)), [], 'nothing left up but his pay');

    // Bassem collects the fee once
    await board(b, /Order a piece forged/);
    await pick(b, /Collect your pay\s*\(?600/); // the price shows as a badge
    await until([b], () => /You collected 600 gold for commissions/.test(window.__toastSeen));
    assert.equal(await b.eval(() => window.__G.S.gold), 5600);
    await settle(a, b);
    assert.deepEqual(await orders(b), []);

    // an order nobody holds is taken off: the fee and the materials back
    await a.eval(() => { const S = window.__G.S; S.mats.ore = 5; S.mats.wood = 1; });
    await board(a, /Order a piece forged/);
    await pick(a, /^(\d+\.\s*)?Order a piece$/);
    await pick(a, new RegExp('^(\\d+\\.\\s*)?' + name + ' \\('));
    await pick(a, /^(\d+\.\s*)?1200 gold$/);
    await until([a], () => window.__G.S.cord.length === 1 && !window.__GCOM.busy);
    await settle(a);
    await board(a, /Order a piece forged/);
    await pick(a, new RegExp('^(\\d+\\.\\s*)?' + name + ' · '));
    await until([a], () => /Order taken off: 1200 gold and the materials back/.test(window.__toastSeen));
    assert.deepEqual(await a.eval(() => { const S = window.__G.S; return [S.gold, S.mats.ore | 0, S.mats.wood | 0, S.cord.length]; }), [4400, 5, 1, 0]);
    assert.deepEqual(await orders(a), []);

    for (const g of [a, b, c]) {
      assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), [], 'no write refused');
      assert.deepEqual(g.errors, []);
    }
  } finally { await ctx.close(); }
});

// a changed client's broken piece: the owner gets the ordered piece, plain, and no refund (the smith was paid); an order the
// server never got (the page closed while it was sent) is taken off at once, with its fee and materials back
test('a broken piece is the ordered one, plain, never a refund; an order the server never got comes back at once', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gCmA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gCmB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    for (const g of [a, b]) await g.eval(() => { const S = window.__G.S; S.gold = 5000; S.mats = { ore: 5, wood: 1 }; });
    await settle(a, b);
    const name = await a.eval(() => window.__G.lines().en.isword);
    const sw0 = await swords(a);
    await board(a, /Order a piece forged/);
    await pick(a, /^(\d+\.\s*)?Order a piece$/);
    await pick(a, new RegExp('^(\\d+\\.\\s*)?' + name + ' \\('));
    await pick(a, /^(\d+\.\s*)?600 gold$/);
    await until([a], () => /Your order is up for the smiths/.test(window.__toastSeen));
    const oid = (await orders(a))[0].split('/')[1];
    await settle(a, b);
    // Bassem's changed client claims it and answers with a piece whose last id is another
    const r = await b.eval(async (oid) => {
      const F = window.__GLD.fb(), D = F.m.database, SV = D.serverTimestamp(), me = Satisfy.local.net().uid, o = (await D.get(D.ref(F.db, 'commOrders/' + oid))).val();
      const w = async (u) => { try { await D.update(D.ref(F.db), u); return 'ok'; } catch (e) { return 'no'; } };
      const c = await w({ ['commClaim/' + oid]: { s: me, t: SV, t0: SV } });
      const f = await w({ ['commOrders/' + oid]: null, ['commClaim/' + oid]: null, ['commDone/' + o.by + '/' + oid]: { rc: 'isword', json: '{"id":"isword","r":4,"id":"gsword"}', by: me, sn: 'Bassem', fee: 600, t: SV }, ['commPaid/' + me + '/' + oid]: { g: 600, t: SV } });
      return [c, f];
    }, oid);
    assert.deepEqual(r, ['ok', 'ok'], 'the rules let it through: it begins with the order\'s recipe');
    await until([a], () => /came broken/.test(window.__toastSeen), 15000);
    const got = await a.eval(() => { const S = window.__G.S, L = S.items.filter((i) => i.id === 'isword'); return { n: L.length, r: L[L.length - 1].r, by: L[L.length - 1].by, gold: S.gold, ore: S.mats.ore | 0, cord: S.cord.length }; });
    assert.deepEqual(got, { n: sw0 + 1, r: 0, by: 'Bassem', gold: 4400, ore: 0, cord: 0 }, 'the ordered sword, plain, with the smith\'s name; nothing refunded');

    // an order in the save that the server never got
    await a.eval(() => { const S = window.__G.S; S.gold -= 700; S.cord.push({ oid: 'c_gCmA1_lost1', rc: 'isword', fee: 700, m: { ore: 5, wood: 1 } }); });
    await board(a, /Order a piece forged/);
    await pick(a, new RegExp('^(\\d+\\.\\s*)?' + name + ' · '));
    await until([a], () => /Order taken off: 700 gold and the materials back/.test(window.__toastSeen));
    assert.deepEqual(await a.eval(() => { const S = window.__G.S; return [S.gold, S.mats.ore | 0, S.mats.wood | 0, S.cord.length]; }), [4400, 5, 1, 0]);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
