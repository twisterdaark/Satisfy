'use strict';
// SAT-ONLINE-104 (plan U230) over the fake Firebase with the rules' checks: the ranks' rights. Officers invite, take from
// the vault, spend the treasury, write the notice and plan events until the master takes a right away; members do none of
// it until the master gives it. The master sets them in G -> "Rank rights"; the rules hold each one (an officer without
// "take" can't take another's thing from the vault, also writing to the database itself). The rights stay through a new
// banner. And a guild's own records go only with the guild: a master can't clear the weekly rewards taken (to take them
// again) or the log while the guild stands.
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
const G1 = 'g_gPrA1';
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
  for (let i = 0; i < 4 && await g.eval(() => (document.getElementById('dopts').hidden && !document.querySelector('#gwB .gwopts button'))); i++) { await g.eval(() => window.__G.advance()); await g.step(2); }
  return g.eval(() => [...document.querySelectorAll('#dopts button, #gwB .gwopts button')].map((x) => x.textContent.replace(/^\d+\.\s*/, '')));
}
const pick = async (g, re) => { await opts(g); await g.eval((src) => { const r = new RegExp(src); [...document.querySelectorAll('#dopts button, #gwB .gwopts button')].find((x) => r.test(x.textContent)).click(); }, re.source); await g.step(2); };

test('guild rank rights: the master gives and takes them, the rules hold them; guild records go only with the guild', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gPrA1', 'Ahmed', LOOK_A);
    const b = await signIn(ctx, 'b', 'gPrB2', 'Bassem', LOOK_B);
    const c = await signIn(ctx, 'c', 'gPrC3', 'Carim', LOOK_C);
    for (const [g, dx] of [[b, 20], [c, -20]]) await g.eval((d) => { window.__G.P.x += d; }, dx);
    for (const g of [a, b, c]) await g.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 50000; S.mats.ore = 20; });
    await settle(a, b, c);
    await a.eval(() => window.__GG.create('Rights'));
    await until([a], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    await inviteFromCard(a, b, 'gPrB2', 'r');
    await inviteFromCard(a, c, 'gPrC3', 'r');
    await a.eval(() => window.__GG.rank('gPrB2', 'o'));
    await until([b], () => window.__GG.state().rank === 'o');

    // the defaults: an officer has every right, a member none
    for (const x of ['invite', 'take', 'spend', 'note', 'ev']) {
      assert.equal(await can(b, x), true, 'officer: ' + x);
      assert.equal(await can(c, x), false, 'member: ' + x);
    }
    // Carim puts ore in the vault; Bassem (an officer) could take it
    await c.eval(() => window.__GG.put('ore'));
    await until([a, b, c], () => Object.keys(window.__GG.vault()).length === 1);
    const vid = await b.eval(() => Object.keys(window.__GG.vault())[0]);
    assert.equal(await b.eval((v) => window.__GG.canTake(v), vid), true);

    // the master, in G -> Rank rights: officers can't take others' things; members may write the notice
    await a.page.keyboard.press('KeyG'); await a.step(2); await a.eval(() => window.__GDW.tab('x')); await a.step(2);
    await pick(a, /^(\d+\.\s*)?Rank rights$/);
    const rows = await opts(a);
    assert.deepEqual(rows.slice(0, 10), ["Officers: invite and answer requests to join ✓", "Officers: take others' things from the vault ✓", 'Officers: spend the treasury on buildings ✓', 'Officers: write the guild notice ✓', 'Officers: plan guild events ✓',
      "Members: invite and answer requests to join ✗", "Members: take others' things from the vault ✗", 'Members: spend the treasury on buildings ✗', 'Members: write the guild notice ✗', 'Members: plan guild events ✗']);
    await pick(a, /^(\d+\.\s*)?Officers: take others' things from the vault ✓$/);
    await until([a], () => /The rights changed/.test(window.__toastSeen));
    await until([a], () => [...document.querySelectorAll('#dopts button, #gwB .gwopts button')].some((x) => /Officers: take others' things from the vault ✗/.test(x.textContent)));
    await pick(a, /^(\d+\.\s*)?Members: write the guild notice ✗$/);
    await until([b, c], () => { const p = window.__GG.state().perm; return !!p && p.o && p.o.take === false && p.r && p.r.note === true; });
    assert.deepEqual(await a.eval(() => window.__fakeRTDB.data.get('guilds/g_gPrA1').perm), { o: { take: false }, r: { note: true } }, 'only what differs from the defaults');

    // Bassem can't take Carim's ore any more, in the game or by writing the database himself
    assert.equal(await can(b, 'take'), false);
    assert.equal(await b.eval((v) => window.__GG.canTake(v), vid), false);
    assert.equal(await write(b, { ['guildVault/g_gPrA1/' + vid]: null, ['guildVaultTaken/g_gPrA1/' + vid]: { by: 'gPrB2', t: 'SV' } }), 'no', 'the rules hold it');
    assert.equal(await can(b, 'invite'), true, 'his other rights stay');
    // Carim, a member, writes the notice now; Bassem still can too
    assert.equal(await can(c, 'note'), true);
    await c.eval(() => window.__GLD.setNote('Members may write here now'));
    await until([a], () => (window.__GLD.note() || {}).n === 'Carim');
    assert.equal(await can(c, 'take'), false, 'but still no other right');
    assert.equal(await write(c, { ['guildEvents/g_gPrA1/e_x1']: { title: 'Raid', at: Date.now() + 864e5, by: 'gPrC3', n: 'Carim', t: 'SV' } }), 'no', 'no events without the right');

    // a new banner keeps the rights
    await a.eval(() => window.__GG.state() && window.__GLD.emblem(3));
    await until([a], () => (window.__fakeRTDB.data.get('guilds/g_gPrA1') || {}).emb === 3);
    assert.deepEqual(await a.eval(() => window.__fakeRTDB.data.get('guilds/g_gPrA1').perm), { o: { take: false }, r: { note: true } });

    // a guild's own records go with the guild only
    assert.equal(await write(a, { 'guildWeekPaid/g_gPrA1': null }), 'no', 'the weekly rewards taken stay taken');
    assert.equal(await write(a, { 'guildLog/g_gPrA1': null }), 'no', 'the log stays');
    // disbanding still clears everything at once
    await a.eval(() => window.__GLD.disband());
    await until([a], () => ![...window.__fakeRTDB.data.keys()].some((k) => /^guild[A-Za-z]*\/g_gPrA1(\/|$)/.test(k)));
    for (const g of [a, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/guildVault|guildEvents|guildWeekPaid|guildLog/.test(x))), []);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
