'use strict';
// SAT-ONLINE-088 (plan U333) over the fake Firebase with the rules' checks: each game keeps its own class's numbers for the
// week (monsters killed and the time from the first hit, PvP wins and losses) and writes them to balance/{uid}; the
// owner's "/balance" adds them up by class. A warrior and a mage kill monsters and fight once; the board shows both
// classes with their kills, time to kill and PvP record. Only admins read the numbers; nobody writes another's.
// SAT-ONLINE-093: the gold that came in and went out this week, summed in "/economy" with a warning.
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
async function signIn(ctx, k, uid, name, look, admin) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n, a]) => { const D = window.__fakeRTDB.data; if (a) D.set('admins/' + u, true); D.set('accountIds/' + u, n); D.set('handles/' + n.toLowerCase(), u); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name, !!admin]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  return g;
}
async function type(g, text) {
  await g.page.keyboard.press('Enter'); await g.step(1);
  await g.page.keyboard.type(text); await g.page.keyboard.press('Enter'); await g.step(2);
}
// every page of the open dialog, up to its choices
async function pages(g) {
  const out = [];
  for (let i = 0; i < 16; i++) { out.push(await g.eval(() => document.getElementById('dtext').textContent)); if (!(await g.eval(() => document.getElementById('dopts').hidden))) break; await g.eval(() => window.__G.advance()); await g.step(2); }
  return out;
}
async function shut(g) { for (let i = 0; i < 8 && (await g.eval(() => window.__G.mode)) === 'dialog'; i++) { await g.eval(() => { const o = [...document.querySelectorAll('#dopts button')]; if (document.getElementById('dopts').hidden || !o.length) window.__G.advance(); else o[o.length - 1].click(); }); await g.step(2); } }
const canRead = (g, p) => g.eval(async (path) => { const F = window.__GLD.fb(), D = F.m.database; try { await D.get(D.ref(F.db, path)); return 'ok'; } catch (e) { return 'no'; } }, p);
const write = (g, u) => g.eval(async (x) => { const F = window.__GLD.fb(), D = F.m.database; for (const k in x) if (x[k] && x[k].t === 'SV') x[k].t = D.serverTimestamp(); try { await D.update(D.ref(F.db), x); return 'ok'; } catch (e) { return 'no'; } }, u);
// hit one monster away from the others (alone, the game runs its own monsters), wait `secs` of game time, then kill it with
// a second hit: the time to kill runs from the first hit
async function killOne(g, secs) {
  const n0 = await g.eval(() => window.__GMOD.bal().n);
  await g.eval(() => { const G = window.__G, P = G.P, rs = Satisfy.local.net().remotes; const m = G.mons().find((x) => !x.dead && !x.fh && x.max < 5000 && !/rabbit|merman/.test(x.type) && rs.every((r) => Math.hypot(r.x - x.x, r.y - x.y) > 1000)); P.x = m.x - 12; P.y = m.y - 4; P.inv = 1e9; });
  await g.step(20);
  await g.eval(() => { const G = window.__G, P = G.P; const m = G.mons().filter((x) => !x.dead && !x.fh && x.max < 5000 && !/rabbit|merman/.test(x.type)).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0]; window.__bm = m; m.stun = 1e9; P.x = m.x - 12; P.y = m.y - 4; m.hp = m.max = 1e6; P.acd = 0; G.tryAttack(1, 0); });
  assert.ok(await g.eval(() => window.__bm.fh > 0), 'the first hit landed');
  await g.step(Math.round(secs * 60));
  await g.eval(() => { const G = window.__G, P = G.P, m = window.__bm; P.x = m.x - 12; P.y = m.y - 4; m.hp = 1; P.acd = 0; G.tryAttack(1, 0); });
  assert.equal(await g.eval(() => window.__GMOD.bal().n), n0 + 1, 'killed and counted');
}
async function strike(a, b) {
  const uid = await b.eval(() => Satisfy.local.net().uid);
  await a.eval(() => { window.__G.P.acd = 0; });
  const p = await a.eval((u) => { const r = Satisfy.local.net().remotes.find((x) => x.uid === u); return window.__G.toScreen(r.x, r.y - 11); }, uid);
  await a.page.mouse.click(p.x, p.y, { modifiers: [] });
  await a.step(1);
  await settle(a, b);
}
const place = (g, dx) => g.eval((d) => { const G = window.__G; G.P.x = 90 * 16 + d; G.P.y = 60 * 16; G.P.inv = 0; for (const m of G.mons()) { if (Math.hypot(m.x - G.P.x, m.y - G.P.y) < 300) { m.dead = true; m.rt = 1e9; } } }, dx);

test('balance figures: each class\'s kills, time to kill and PvP record this week, for the owner only', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const own = await signIn(ctx, 'a', 'gBaA1', 'Twister', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }, true);
    const b = await signIn(ctx, 'b', 'gBaB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const c = await signIn(ctx, 'c', 'gBaC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await b.eval(() => { const S = window.__G.S; S.cls = 'warrior'; S.lv = 12; });
    await c.eval(() => { const S = window.__G.S; S.cls = 'mage'; S.lv = 8; });
    await settle(own, b, c);

    // the warrior kills one monster in about 2 s; the mage two, in about 1 and 3 s
    await killOne(b, 2);
    await killOne(c, 1); await killOne(c, 3);
    const vb = await b.eval(() => window.__GMOD.bal());
    assert.equal(vb.n, 1);
    assert.ok(vb.s >= 1.9 && vb.s <= 2.2, 'about 2 s: ' + vb.s);
    assert.match(vb.wk, /^w\d+$/);
    const vc = await c.eval(() => window.__GMOD.bal());
    assert.equal(vc.n, 2);
    assert.ok(vc.s >= 3.9 && vc.s <= 4.3, 'about 1 + 3 s: ' + vc.s);
    // one open-PvP fight outside town: the warrior wins
    await place(b, 0); await place(c, 18);
    await settle(b, c);
    await c.eval(() => { window.__G.P.hp = 1; });
    for (let i = 0; i < 3 && (await c.eval(() => window.__G.mode)) !== 'dead'; i++) await strike(b, c);
    assert.equal(await c.eval(() => window.__G.mode), 'dead');
    await settle(b, c);
    assert.equal(await b.eval(() => window.__GMOD.bal().w), 1);
    assert.equal(await c.eval(() => window.__GMOD.bal().l), 1);

    // written to balance/{uid}: the owner reads them, a player doesn't, and nobody writes another's
    for (const g of [b, c]) await g.eval(() => window.__GMOD.balPush());
    await until([own], () => window.__fakeRTDB.data.has('balance/gBaB2') && window.__fakeRTDB.data.has('balance/gBaC3'));
    assert.deepEqual(await own.eval(() => { const v = window.__fakeRTDB.data.get('balance/gBaB2'); return [v.cls, v.lv, v.n, v.w, v.l]; }), ['warrior', 12, 1, 1, 0]);
    assert.equal(await canRead(b, 'balance'), 'no');
    assert.equal(await canRead(own, 'balance'), 'ok');
    assert.equal(await write(c, { 'balance/gBaB2': { wk: vb.wk, cls: 'warrior', lv: 12, n: 0, s: 0, w: 0, l: 50, t: 'SV' } }), 'no', 'not another\'s');
    assert.equal(await write(c, { 'balance/gBaC3': { wk: vb.wk, cls: 'mage', lv: 8, n: -1, s: 0, w: 0, l: 0, t: 'SV' } }), 'no', 'no negative counts');

    // the owner's board, by class
    await b.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
    await type(b, '/balance');
    await until([b], () => /Only the game's owner can do that/.test(window.__toastSeen));
    assert.equal(await b.eval(() => window.__G.mode), 'play', 'no board for a player');
    await type(own, '/balance'); await own.step(2);
    await until([own], () => /Balance \(w\d+, 2 players\)/.test(document.getElementById('dialog').textContent));
    const P = await pages(own);
    assert.equal(P[0], 'Balance (' + vb.wk + ', 2 players)');
    assert.match(P[1], /^Magician: 1 players \(Lv \d+\) · 2 kills, 2(\.\d)? s each · PvP 0–1 \(0%\) · duels 0–0, open 0–1 · a player killed in - s, lasted \d+(\.\d)? s$/);   // plan U045: duels apart, PvP kill time, survival
    assert.match(P[2], /^Warrior: 1 players \(Lv \d+\) · 1 kills, 2(\.\d)? s each · PvP 1–0 \(100%\) · duels 0–0, open 1–0 · a player killed in \d+(\.\d)? s, lasted - s$/);
    // the sums: last week's numbers don't count; no PvP is "-"
    assert.deepEqual(await own.eval(() => window.__GMOD.balStats({ a: { wk: 'w9', cls: 'mage', lv: 10, n: 10, s: 30, w: 1, l: 1 }, b: { wk: 'w9', cls: 'mage', lv: 20, n: 0, s: 0, w: 2, l: 0 }, c: { wk: 'w8', cls: 'mage', lv: 50, n: 99, s: 1, w: 0, l: 9 }, d: { wk: 'w9', cls: 'archer', lv: 5, n: 4, s: 10, w: 0, l: 0 } }, 'w9')),
      [{ c: 'mage', p: 2, lv: 15, n: 10, ttk: 3, w: 3, l: 1, rate: 75, dw: 0, dl: 0, ow: 3, ol: 1, pttk: null, surv: null }, { c: 'archer', p: 1, lv: 5, n: 4, ttk: 2.5, w: 0, l: 0, rate: null, dw: 0, dl: 0, ow: 0, ol: 0, pttk: null, surv: null }]);
    // SAT-ONLINE-093: gold in and out this week, from every change of the bag's gold; "/economy" sums it and warns
    await shut(own);
    const g0 = await b.eval(() => Object.assign({}, window.__GMOD.bal()));
    await b.eval(() => { window.__G.S.gold += 1000; }); await b.step(2);
    await b.eval(() => { window.__G.S.gold -= 300; }); await b.step(2);
    const g1 = await b.eval(() => window.__GMOD.bal());
    assert.equal(g1.gi - g0.gi, 1000); assert.equal(g1.go - g0.go, 300);
    await own.eval(() => { window.__G.S.gold += 5000; }); await own.step(2);
    for (const g of [own, b, c]) await g.eval(() => window.__GMOD.balPush());
    await until([own], () => { const v = window.__fakeRTDB.data.get('balance/gBaB2'); return !!v && v.gi >= 1000 && window.__fakeRTDB.data.has('balance/gBaA1'); });
    await type(own, '/economy'); await own.step(2);
    await until([own], () => /Economy \(/.test(document.getElementById('dialog').textContent));
    const E = await pages(own);
    assert.match(E[1], /^This week \(3 players\): [\d,]+ gold came in and [\d,]+ went out, \+[\d,]+ · ⚠ [\d.]+ times as much comes in as goes out$/);
    assert.deepEqual(await own.eval(() => window.__GMOD.flow({ a: { wk: 'w9', gi: 100, go: 100 }, b: { wk: 'w9', gi: 50, go: 0 }, c: { wk: 'w8', gi: 9999, go: 0 } }, 'w9')), { n: 2, gi: 150, go: 100, r: 1.5, warn: false });
    assert.equal((await own.eval(() => window.__GMOD.flow({ a: { wk: 'w9', gi: 900, go: 100 }, b: { wk: 'w9', gi: 0, go: 50 }, c: { wk: 'w9' } }, 'w9'))).warn, true, 'three players, six times as much in');
    for (const g of [own, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/balance/.test(x))), []);
    for (const g of [own, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
