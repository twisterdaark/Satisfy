'use strict';
// SAT-ONLINE-106 (plan U226) over the fake Firebase with the rules' checks: the castle city's tax. The master of the guild
// holding Reidan Castle sets a tax on what Reidan's people sell, at most 10% (the rules refuse more) and once an hour. A
// buyer from outside pays it on top; it reaches the guild as entries, which a member collects into the treasury, each
// once and only for its amount. The guild's own members pay none; nobody else sets it or pays it to a guild that doesn't
// hold the castle, and a member can't make tax for their own guild.
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
const G1 = 'g_gTxA1';
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
// move a page's clock on by ms from where it is (its Date.now, which the fake's rules use too)
const later = (g, ms) => g.eval((d) => { if (!window.__now0) { window.__now0 = Date.now; window.__dt = 0; } window.__dt += d; const b = window.__now0; Date.now = () => b() + window.__dt; }, ms);
async function opts(g) {
  for (let i = 0; i < 4 && await g.eval(() => document.getElementById('dopts').hidden); i++) { await g.eval(() => window.__G.advance()); await g.step(2); }
  return g.eval(() => [...document.querySelectorAll('#dopts button')].map((x) => x.textContent.replace(/^\d+\.\s*/, '')));
}
const pick = async (g, re) => { await opts(g); await g.eval((src) => { const r = new RegExp(src); [...document.querySelectorAll('#dopts button')].find((x) => r.test(x.textContent)).click(); }, re.source); await g.step(2); };
const G = 'g_gTxA1', TAX = (r, by) => ({ 'world/satisfy/tax': { g: G, r, by, t: 'SV' } });
const entries = (g) => g.eval(() => { const o = {}; for (const [p, v] of window.__fakeRTDB.data) { const m = p.match(/^guildTax\/g_gTxA1\/(.+)$/); if (m) o[m[1]] = v.g; } return o; });

test('city tax: up to 10%, once an hour, paid by outsiders in Reidan, collected into the treasury once', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gTxA1', 'Ahmed', LOOK_A);
    const b = await signIn(ctx, 'b', 'gTxB2', 'Bassem', LOOK_B);
    const c = await signIn(ctx, 'c', 'gTxC3', 'Carim', LOOK_C);
    for (const [g, dx] of [[b, 20], [c, -20]]) await g.eval((d) => { window.__G.P.x += d; }, dx);
    for (const g of [a, b, c]) await g.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 100000; });
    await settle(a, b, c);
    await a.eval(() => window.__GG.create('Crown'));
    await until([a], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    await inviteFromCard(a, c, 'gTxC3', 'r');
    // Crown holds Reidan Castle (as the territory rules would have it), for every page
    for (const g of [a, b, c]) await g.eval((gid) => { window.__fakeRTDB.data.set('world/satisfy/own/castle', { g: gid, n: 'Crown', c: '#5aa0ff', h: 'Ahmed', uid: 'gTxA1', t: Date.now() }); window.__GU.WS.castle.own = gid; }, G);
    assert.equal(await b.eval(() => window.__GTAX.town('innR')), 'zReid');

    // the master sets it in G: 10%; more is refused, and so is a second change within the hour
    await a.page.keyboard.press('KeyG'); await a.step(2);
    await pick(a, /^(\d+\.\s*)?City tax: 0%$/);
    assert.deepEqual((await opts(a)).slice(0, 5), ['0% ✓', '2%', '5%', '8%', '10%']);
    await pick(a, /^(\d+\.\s*)?10%$/);
    await until([a, b, c], () => { const r = window.__GTAX.rate; return !!r && r.r === 10; });
    assert.equal(await write(a, TAX(15, 'gTxA1')), 'no', 'never more than 10%');
    assert.equal(await write(a, TAX(5, 'gTxA1')), 'no', 'once an hour');
    assert.equal(await write(b, TAX(1, 'gTxB2')), 'no', "only the castle guild's master");

    // Bassem, from outside, pays 10% more at Reidan's inn; Carim, of Crown, pays the price; elsewhere nobody pays it
    assert.equal(await b.eval(() => window.__GTAX.rateAt('innR')), 10);
    assert.equal(await c.eval(() => window.__GTAX.rateAt('innR')), 0, "the guild's own members pay none");
    assert.equal(await b.eval(() => window.__GTAX.rateAt('inn')), 0, 'only in Reidan');
    const pb = await b.eval(() => window.__GTAX.price('innR', 100)), pc = await c.eval(() => window.__GTAX.price('innR', 100));
    assert.equal(pb, Math.round(pc * 1.1), 'the price with the tax on top: ' + pb + ' / ' + pc);
    const g0 = await b.eval(() => window.__G.S.gold);
    await b.eval(() => { window.__G.S.hpot = 9; window.__GTAX.pot('innR', 'hpot'); });
    const paid = g0 - await b.eval(() => window.__G.S.gold), owed = paid - Math.round(paid / 1.1);
    assert.ok(owed >= 1, 'a tax on ' + paid);
    assert.equal(await b.eval(() => window.__GTAX.owed), owed);
    await b.eval(() => window.__GTAX.flush());
    await until([a], (x) => Object.values((() => { const o = {}; for (const [p, v] of window.__fakeRTDB.data) if (/^guildTax\/g_gTxA1\//.test(p)) o[p] = v.g; return o; })()).reduce((s, y) => s + y, 0) === x, 10000, owed);

    // the rules: a member makes no tax for its own guild, nobody pays it to a guild without the castle
    assert.equal(await write(c, { 'guildTax/g_gTxA1/x_fake1': { g: 50000, by: 'gTxC3', n: 'Carim', t: 'SV' } }), 'no', "a member can't make tax for its guild");
    assert.equal(await write(b, { 'guildTax/g_gOther/x_fake2': { g: 10, by: 'gTxB2', n: 'Bassem', t: 'SV' } }), 'no', 'only to the castle guild');
    const [eid] = Object.keys(await entries(a));
    assert.equal(await write(c, { ['guildTax/g_gTxA1/' + eid]: null }), 'no', 'not off without going into the treasury');
    assert.equal(await write(c, { ['guildTax/g_gTxA1/' + eid]: null, 'guildBank/g_gTxA1': { in: owed + 1, s: 0, lb: 'gTxC3', lg: owed + 1, tx: eid, t: 'SV' } }), 'no', 'its own amount, no more');

    // Carim collects it into the treasury, once
    await c.eval(() => window.__GTAX.watch());
    await until([c], () => Object.keys(window.__GTAX.waiting || {}).length === 1);
    await c.eval(() => window.__GTAX.collect());
    await until([a], (x) => ((window.__fakeRTDB.data.get('guildBank/g_gTxA1') || {}).in || 0) === x, 10000, owed);
    await until([a], () => ![...window.__fakeRTDB.data.keys()].some((k) => /^guildTax\//.test(k)));
    await until([c], () => /went into the treasury/.test(window.__toastSeen));

    // an hour later the master changes it
    await later(a, 61 * 60000);
    assert.equal(await write(a, TAX(5, 'gTxA1')), 'ok');
    for (const g of [a, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/tax|guildTax|guildBank/.test(x))), []);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
