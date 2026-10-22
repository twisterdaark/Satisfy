'use strict';
// SAT-ONLINE-105 (plan U237) over the fake Firebase with the rules' checks: the guild research tree. Seven studies paid
// from the treasury, each once, after the ones it needs, and each a bonus for every member (experience, gold, crafting,
// health). The master and officers (or a member given "spend") research; the rules take exactly each study's cost from
// the treasury: none skipped, none out of order, no cost negative or short.
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
// a toast lives 2.6 s of real time: every page keeps the toasts it has shown
const toasts = (g) => g.eval(() => window.__toastSeen || '');
const keepToasts = (g) => g.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  if (look) await H.newGame(g, look); else await H.continueGame(g); // the character saved in this slot
  await keepToasts(g);
  return g;
}
const LOOK_A = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }, LOOK_B = { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 }, LOOK_C = { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 };
const G1 = 'g_gRsA1';
const rk = (g) => g.eval((gid) => { const o = {}; for (const [p, v] of window.__fakeRTDB.data) { const m = p.match(/^guildMembers\/([^/]+)\/([^/]+)$/); if (m && m[1] === gid) o[m[2]] = v.rk; } return o; }, G1);
const master = (g) => g.eval((gid) => (window.__fakeRTDB.data.get('guilds/' + gid) || {}).master || null, G1);
// A invites B from B's card; B joins from the prompt
async function inviteFromCard(a, b, uidB, rank) {
  await a.eval((u) => { const r = Satisfy.local.net().remotes.find((x) => x.uid === u); window.__G.P.x = r.x - 16; window.__G.P.y = r.y; }, uidB);
  await a.step(3); await a.page.keyboard.press('KeyT'); await a.step(2);
  await a.eval(() => document.querySelector('#pctx [data-act="pcGuild"]').click());
  await until([b], () => !document.getElementById('guildInv').hidden);
  await b.eval(() => document.querySelector('#guildInv [data-act="gdYes"]').click());
  await until([b], (r) => { const s = window.__GG.state(); return !!s && s.rank === r; }, 10000, rank);
}

const write = (g, u) => g.eval(async (x) => { const F = window.__GLD.fb(), D = F.m.database; for (const k in x) if (x[k] && x[k].t === 'SV') x[k].t = D.serverTimestamp(); try { await D.update(D.ref(F.db), x); return 'ok'; } catch (e) { return 'no'; } }, u);
const can = (g, a) => g.eval((x) => window.__GG.state() && window.__GLD.can(x), a);
async function opts(g) {
  for (let i = 0; i < 4 && await g.eval(() => document.getElementById('dopts').hidden); i++) { await g.eval(() => window.__G.advance()); await g.step(2); }
  return g.eval(() => [...document.querySelectorAll('#dopts button')].map((x) => x.textContent.replace(/^\d+\.\s*/, '')));
}
const pick = async (g, re) => { await opts(g); await g.eval((src) => { const r = new RegExp(src); [...document.querySelectorAll('#dopts button')].find((x) => r.test(x.textContent)).click(); }, re.source); await g.step(2); };

const bank = (g) => g.eval(() => window.__fakeRTDB.data.get('guildBank/g_gRsA1') || null);
const done = (g) => g.eval(() => { const o = []; for (const [p, v] of window.__fakeRTDB.data) { const m = p.match(/^guildBuild\/g_gRsA1\/([a-z0-9]+)$/); if (m && v === 1 && !['forge', 'train', 'gold'].includes(m[1])) o.push(m[1]); } return o.sort(); });
async function research(g, r) {
  const b0 = (await bank(g)).s;
  await g.eval((x) => window.__GBD.research(x), r);
  await until([g], ([x, s]) => window.__fakeRTDB.data.get('guildBuild/g_gRsA1/' + x) === 1 && (window.__fakeRTDB.data.get('guildBank/g_gRsA1') || {}).s > s, 10000, [r, b0]);
  return (await bank(g)).s - b0;
}

test('guild research: studies paid once from the treasury, in order, a bonus for every member; the rules hold the cost', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gRsA1', 'Ahmed', LOOK_A);
    const b = await signIn(ctx, 'b', 'gRsB2', 'Bassem', LOOK_B);
    const c = await signIn(ctx, 'c', 'gRsC3', 'Carim', LOOK_C);
    for (const [g, dx] of [[b, 20], [c, -20]]) await g.eval((d) => { window.__G.P.x += d; }, dx);
    for (const g of [a, b, c]) await g.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 2000000; });
    await settle(a, b, c);
    await a.eval(() => window.__GG.create('Scholars'));
    await until([a], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    await inviteFromCard(a, b, 'gRsB2', 'r');
    await inviteFromCard(a, c, 'gRsC3', 'r');
    await a.eval(() => window.__GG.rank('gRsB2', 'o'));
    await until([b], () => window.__GG.state().rank === 'o');
    // 900,000 gold in the treasury
    for (let i = 0; i < 9; i++) { const s0 = ((await bank(a)) || { in: 0 }).in; await a.eval(() => window.__GBD.give(100000)); await until([a], (x) => ((window.__fakeRTDB.data.get('guildBank/g_gRsA1') || {}).in || 0) === x + 100000, 10000, s0); }
    await settle(a, b, c);

    // the tree: three open at the start, the rest locked behind them
    await b.eval(() => window.__GBD.rs()); await b.step(2);
    let txt = '';
    for (let i = 0; i < 6; i++) { txt += ' | ' + await b.eval(() => document.getElementById('dtext').textContent); if (!(await b.eval(() => document.getElementById('dopts').hidden))) break; await b.eval(() => window.__G.advance()); await b.step(2); }
    assert.match(txt, /Hunting Studies: \+2% experience · 30,000 gold/);
    assert.match(txt, /🔒 Arts of War: \+3% experience · needs Hunting Studies/);
    assert.match(txt, /🔒 Guild Legacy: \+2% experience, \+2% gold, \+2% health · needs Arts of War, Caravan Roads, Smiths' Armour/);
    const offers = await b.eval(() => [...document.querySelectorAll('#dopts button')].map((x) => x.textContent.replace(/^\d+\.\s*/, '')));
    assert.deepEqual(offers.filter((x) => /^Research /.test(x)).map((x) => x.match(/^Research ([A-Za-z' ]+?)\s*(\(|\d|$)/)[1]), ['Hunting Studies', 'Trade Studies', 'Craft Studies'], 'only the open ones are offered');

    // the rules: nothing out of order, no cost short or negative, nobody without "spend"
    const bk = await bank(a), st = (s) => ({ in: bk.in, s, lb: bk.lb, lg: bk.lg, t: 'SV' });
    assert.equal(await write(b, { 'guildBuild/g_gRsA1/xp2': 1, 'guildBank/g_gRsA1': st(bk.s + 120000) }), 'no', 'not before what it needs');
    assert.equal(await write(b, { 'guildBuild/g_gRsA1/xp1': 1, 'guildBank/g_gRsA1': st(bk.s + 1) }), 'no', 'not for less');
    assert.equal(await write(b, { 'guildBuild/g_gRsA1/xp1': 1, 'guildBank/g_gRsA1': st(bk.s - 30000) }), 'no', 'no negative cost');
    assert.equal(await write(b, { 'guildBuild/g_gRsA1/xp1': 1 }), 'no', 'not free');
    assert.equal(await write(c, { 'guildBuild/g_gRsA1/xp1': 1, 'guildBank/g_gRsA1': st(bk.s + 30000) }), 'no', 'a member without "spend"');
    assert.equal(await write(b, { 'guildBuild/g_gRsA1/xp1': 2, 'guildBank/g_gRsA1': st(bk.s + 30000) }), 'no', 'a study has one level');

    // the officer researches the first one: its cost leaves the treasury; every member gets the bonus
    const x0 = await c.eval(() => window.__GBD.xpB());
    assert.equal(await research(b, 'xp1'), 30000);
    await until([c], (x) => Math.abs(window.__GBD.xpB() - x - 0.02) < 1e-9, 10000, x0);
    await until([c], () => /Your guild finished Hunting Studies!/.test(window.__toastSeen));
    assert.equal(await write(b, { 'guildBuild/g_gRsA1/xp1': 1, 'guildBank/g_gRsA1': Object.assign(st((await bank(a)).s + 30000), { in: (await bank(a)).in }) }), 'no', 'once');

    // the whole tree, then health and all three at the top
    const hp0 = await c.eval(() => window.__G.maxHP());
    for (const [r, cost] of [['gd1', 30000], ['q1', 30000], ['xp2', 120000], ['gd2', 120000], ['hp1', 120000], ['all', 400000]]) assert.equal(await research(r === 'all' ? a : b, r), cost, r);
    assert.deepEqual(await done(a), ['all', 'gd1', 'gd2', 'hp1', 'q1', 'xp1', 'xp2']);
    await until([c], () => window.__GBD.rsOn('all'));
    assert.equal(Math.round(await c.eval(() => window.__GBD.hpB()) * 100), 5, '+3% and +2% health');
    assert.ok((await c.eval(() => window.__G.maxHP())) > hp0, 'more health');
    assert.equal(Math.round((await c.eval(() => window.__GBD.xpB())) * 100) - Math.round(x0 * 100), 7, '+2, +3 and +2% experience');
    assert.equal((await bank(a)).s, 850000, 'all of it: 850,000');
    for (const g of [a, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/guildBuild|guildBank/.test(x))), []);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
