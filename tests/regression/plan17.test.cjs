'use strict';
// v3.67 plan batch 17, over the fake Firebase with the rules' checks: the owner's /balance gains PvP fairness (plan U045):
// duels apart from open PvP, the time to kill a player and how long one lasted once hit, PvP by gear band and the round
// trip's p95; and "/craftstats all" (plan U284) sums every player's pieces by rating this week and lists the accounts past
// what the forge can give. Only admins read the numbers.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

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
async function signIn(ctx, k, uid, name, look, admin) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n, a]) => { const D = window.__fakeRTDB.data; if (a) D.set('admins/' + u, true); D.set('accountIds/' + u, n); D.set('handles/' + n.toLowerCase(), u); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name, admin]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  return g;
}
async function type(g, text) {
  await g.page.keyboard.press('Enter'); await g.step(1);
  await g.page.keyboard.type(text); await g.page.keyboard.press('Enter'); await g.step(2);
}
async function pages(g) {
  const out = [];
  for (let i = 0; i < 24; i++) { out.push(await g.eval(() => document.getElementById('dtext').textContent)); if (!(await g.eval(() => document.getElementById('dopts').hidden))) break; await g.eval(() => window.__G.advance()); await g.step(2); }
  return out.join('\n');
}
const canRead = (g, p) => g.eval(async (path) => { const F = window.__GLD.fb(), D = F.m.database; try { await D.get(D.ref(F.db, path)); return 'ok'; } catch (e) { return 'no'; } }, p);

test('the owner\'s board: PvP fairness by class and gear band, the round trip, and crafting quality across players', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gBlA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }, true);
    const b = await signIn(ctx, 'b', 'gBlB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    // Bassem, a mage: an open PvP kill 3 s after his first hit, a death after lasting 4.2 s, a duel won; a weapon rated
    // legendary (band: its rating and no armour's, averaged = epic); round trips of 100–300 ms; three pieces, one legendary
    await b.eval(async () => {
      const G = window.__G, S = G.S, X = window.__GBAL; S.cls = 'mage'; S.lv = 80; const w = G.S.items[0]; w.r = 4; S.eqW = w.uid; S.eqA = null;
      X.hit('gBlA1'); await new Promise((r) => setTimeout(r, 0));
    });
    await b.step(180);   // 3 s of the page's clock (the harness steps it)
    const r = await b.eval(() => {
      const X = window.__GBAL; X.pvp(true); X.kill('gBlA1'); X.died(4200); X.pvp(false); X.pvp(true, 1);
      X.craft('isword', 0); X.craft('isword', 2); X.craft('isword', 4);
      X.rtt([100, 110, 120, 130, 140, 150, 160, 170, 180, 300]);
      X.tick(); const v = X.v; return { pn: v.pn, pk: v.pk, pd: v.pd, ps: v.ps, dw: v.dw, w: v.w, l: v.l, c: [v.c0, v.c1, v.c2, v.c3, v.c4], gb: X.gb(), p95: X.p95() };
    });
    assert.equal(r.pn, 1); assert.ok(r.pk >= 2.5 && r.pk < 10, 'the kill took about 3 s: ' + r.pk);
    assert.deepEqual([r.pd, r.ps, r.dw, r.w, r.l, r.gb, r.p95], [1, 4.2, 1, 2, 1, 2, 300]);
    assert.deepEqual(r.c, [1, 0, 1, 0, 1]);
    await until([b], () => { const e = window.__fakeRTDB.data.get('balance/gBlB2'); return !!e && e.c4 === 1; });
    const rec = await b.eval(() => window.__fakeRTDB.data.get('balance/gBlB2'));
    assert.deepEqual([rec.dw, rec.dl, rec.pn, rec.pd, rec.ps, rec.gb, rec.rt, rec.c0, rec.c2, rec.c4, rec.h], [1, undefined, 1, 1, 4.2, 2, 300, 1, 1, 1, 'Bassem']);
    assert.deepEqual(await b.eval(() => window.__fakeRTDB.rejected), [], 'the rules take the record');
    assert.equal(await canRead(b, 'balance'), 'no', 'only admins read it');

    // the owner's board
    await until([a], () => !!window.__fakeRTDB.data.get('balance/gBlB2'));
    await type(a, '/balance');
    await until([a], () => window.__G.mode === 'dialog');
    const txt = await pages(a);
    assert.match(txt, /Magician: 1 players \(Lv 80\)[^\n]* · duels 1–0, open 1–1 · a player killed in \d+(\.\d)? s, lasted 4\.2 s/);
    assert.match(txt, /Gear band Epic: 1 players · PvP 2–1 \(67%\)/);
    assert.match(txt, /Round trip p95: median 300 ms, worst 300 ms \(1 players\)/);
    await a.eval(() => { window.__G.closeDialog ? window.__G.closeDialog() : null; });
    for (let i = 0; i < 6 && (await a.eval(() => window.__G.mode)) === 'dialog'; i++) { await a.eval(() => window.__G.advance()); await a.step(2); const o = await a.eval(() => !document.getElementById('dopts').hidden); if (o) await a.eval(() => [...document.querySelectorAll('#dopts button')].pop().click()); await a.step(2); }

    // crafting quality across players: Bassem's legendary off Pagma is flagged
    await type(a, '/craftstats all');
    await until([a], () => window.__G.mode === 'dialog');
    const cs = await pages(a);
    assert.match(cs, /Crafting quality across all players \(w\d+\): 3 pieces from 1 players/);
    assert.match(cs, /⚠ 1 accounts are past what the forge can give:/);
    assert.match(cs, /Bassem \(Magician\): 3 pieces, 0 Unique, 1 Legendary/);
    // a player who isn't an admin: no board
    await type(b, '/craftstats all');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
