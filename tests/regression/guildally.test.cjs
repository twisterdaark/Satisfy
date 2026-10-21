'use strict';
// SAT-ONLINE-085 (plan U238/U245) over the fake Firebase with the rules' checks: guild alliances. A guild can't make one
// alone (a direct write is refused); Hunters' master proposes to Wolves by name, Wolves' master is told and accepts in G ->
// Diplomacy; both guilds are told, and allied players can't hurt each other in open PvP. Wolves breaks it: both are told,
// both logs record who broke it, and neither may propose again for a day (the rules refuse it too). A third guild's
// proposal is declined, and that guild's log says so.
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
const toasts = (g) => g.eval(() => window.__toastSeen || '');
const keepToasts = (g) => g.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  await keepToasts(g);
  return g;
}
async function opts(g) {
  for (let i = 0; i < 4 && await g.eval(() => document.getElementById('dopts').hidden); i++) { await g.eval(() => window.__G.advance()); await g.step(2); }
  return g.eval(() => [...document.querySelectorAll('#dopts button')].map((x) => x.textContent.replace(/^\d+\.\s*/, '')));
}
const pick = (g, re) => g.eval((src) => { const r = new RegExp(src); [...document.querySelectorAll('#dopts button')].find((x) => r.test(x.textContent)).click(); }, re.source);
// every page of the open dialog, up to its choices
async function pages(g) {
  const out = [];
  for (let i = 0; i < 6; i++) { out.push(await g.eval(() => document.getElementById('dtext').textContent)); if (!(await g.eval(() => document.getElementById('dopts').hidden))) break; await g.eval(() => window.__G.advance()); await g.step(2); }
  return out.join(' / ');
}
const write = (g, u) => g.eval(async (x) => { const F = window.__GLD.fb(), D = F.m.database; for (const k in x) if (x[k] && x[k].t === 'SV') x[k].t = D.serverTimestamp(); try { await D.update(D.ref(F.db), x); return 'ok'; } catch (e) { return 'no'; } }, u);
// close whatever dialog is open (Escape, back to play)
async function shut(g) { for (let i = 0; i < 5 && (await g.eval(() => window.__G.mode)) !== 'play'; i++) { await g.page.keyboard.press('Escape'); await g.step(2); } }
// one attack click on the other player's body (as in pvp.test.cjs)
async function strike(a, b) {
  const uid = await b.eval(() => Satisfy.local.net().uid);
  await a.eval(() => { window.__G.P.acd = 0; });
  const p = await a.eval((u) => { const r = Satisfy.local.net().remotes.find((x) => x.uid === u); return window.__G.toScreen(r.x, r.y - 11); }, uid);
  await a.page.mouse.click(p.x, p.y, { modifiers: [] });
  await a.step(1);
  await settle(a, b);
}
const place = (g, dx) => g.eval((d) => { const G = window.__G; G.P.x = 90 * 16 + d; G.P.y = 60 * 16; G.P.inv = 0; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } }, dx);
const HU = 'g_gAlA1', WO = 'g_gAlB2', RA = 'g_gAlC3';

test('guild alliances: proposed and accepted by both sides, no PvP between allies, broken and logged, a day apart; declined', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gAlA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gAlB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const c = await signIn(ctx, 'c', 'gAlC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await settle(a, b, c);
    for (const [g, n] of [[a, 'Hunters'], [b, 'Wolves'], [c, 'Ravens']]) {
      await g.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 50000; });
      await g.eval((x) => window.__GG.create(x), n);
      await until([g], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    }
    await place(a, 0); await place(b, 18); await place(c, 400);
    await settle(a, b, c);
    // open PvP out here before any alliance
    await b.eval(() => { window.__G.P.hp = window.__G.maxHP(); });
    const hp0 = await b.eval(() => window.__G.P.hp);
    await strike(a, b);
    assert.ok((await b.eval(() => window.__G.P.hp)) < hp0, 'a hit lands');

    // one guild can't make an alliance alone: no proposal from the other side, no entry
    assert.equal(await write(a, { ['guildAlly/' + HU + '/' + WO]: { n: 'Wolves', until: Date.now() + 86400000, t: 'SV' }, ['guildAlly/' + WO + '/' + HU]: { n: 'Hunters', until: Date.now() + 86400000, t: 'SV' } }), 'no');
    assert.equal(await write(a, { ['guildAlly/' + WO + '/' + HU]: { n: 'Hunters', until: Date.now() + 86400000, t: 'SV' } }), 'no');

    // Hunters proposes by name; Wolves' master is told and finds it in G -> Diplomacy
    await a.eval(() => window.__GAL.ask('wolves'));
    await until([b], () => !!window.__GAL.asks.g_gAlA1);
    await settle(a, b);
    assert.match(await toasts(b), /Hunters asks your guild for an alliance \(G → Diplomacy\)/);
    assert.match(await toasts(a), /Proposal sent to Wolves/);
    await b.eval(() => window.__GAL.open()); await b.step(2);
    assert.match(await pages(b), /^Guild allies: 0 of 3 · No allies yet[^/]+ \/ 📜 Hunters asks for an alliance$/);
    assert.ok((await opts(b)).includes('Accept Hunters'));
    await pick(b, /^(\d+\.\s*)?Accept Hunters/);
    await until([a, b], () => !!window.__GAL.of(window.__GG.state().gid === 'g_gAlA1' ? 'g_gAlB2' : 'g_gAlA1'));
    await settle(a, b);
    assert.match(await toasts(a), /Your guild and Wolves are now allies!/);
    assert.match(await toasts(b), /Your guild and Hunters are now allies!/);
    const left = await a.eval(() => window.__GAL.of('g_gAlB2').until - Date.now());
    assert.ok(left > 29.9 * 86400000 && left <= 30 * 86400000, '30 days: ' + left);
    await a.eval(() => window.__GAL.open()); await a.step(2);
    assert.match(await pages(a), /^Guild allies: 1 of 3 · 🤝 Wolves: 30 days left \/ Recent: Wolves accepted our proposal · \d\d:\d\d · Ahmed proposed an alliance to Wolves · \d\d:\d\d$/);
    await a.eval(() => window.__G.advance()); await a.step(2);

    // allies can't hurt each other in open PvP
    await until([a, b], () => { const r = Satisfy.local.net().remotes.find((x) => x.uid === (Satisfy.local.net().uid === 'gAlA1' ? 'gAlB2' : 'gAlA1')); return !!r && !!window.__GG.of(r.uid); }, 15000);
    await shut(a); await shut(b);
    await b.eval(() => { window.__G.P.hp = window.__G.maxHP(); });
    const hp1 = await b.eval(() => window.__G.P.hp);
    await strike(a, b); await strike(a, b);
    assert.ok((await b.eval(() => window.__G.P.hp)) >= hp1, 'no hit between allies');

    // Wolves breaks it (asked to be sure): both told, both logs say who, PvP again
    await b.eval(() => window.__GAL.open()); await b.step(2);
    await opts(b); await pick(b, /End the alliance with Hunters/); await b.step(2);
    assert.match(await pages(b), /End the alliance with Hunters\? Neither guild can propose again for a day/);
    await opts(b); await pick(b, /^(\d+\.\s*)?Yes/);
    await until([a, b], () => Object.keys(window.__GAL.all).length === 0);
    await settle(a, b);
    assert.match(await toasts(a), /The alliance with Wolves ended/);
    assert.match(await toasts(b), /The alliance with Hunters ended/);
    await until([a], () => Object.values(window.__GAL.log).some((e) => e.k === 'break'));
    assert.match(await a.eval(() => window.__GAL.line(Object.values(window.__GAL.log).find((e) => e.k === 'break'))), /^Wolves broke the alliance · \d\d:\d\d$/);
    await until([b], () => Object.values(window.__GAL.log).some((e) => e.k === 'break'));
    assert.match(await b.eval(() => window.__GAL.line(Object.values(window.__GAL.log).find((e) => e.k === 'break'))), /^Bassem broke the alliance with Hunters · \d\d:\d\d$/);
    await shut(a); await shut(b);
    await b.eval(() => { window.__G.P.hp = window.__G.maxHP(); });
    const hp2 = await b.eval(() => window.__G.P.hp);
    await strike(a, b);
    assert.ok((await b.eval(() => window.__G.P.hp)) < hp2, 'open PvP again');

    // a day before either may propose: the game says so, the rules refuse it
    await a.eval(() => window.__GAL.ask('Wolves')); await settle(a);
    assert.match(await toasts(a), /The alliance with Wolves ended less than a day ago\. Try again after \d\d:\d\d/);
    assert.equal(await write(b, { ['guildAllyAsk/' + HU + '/' + WO]: { n: 'Wolves', by: 'gAlB2', t: 'SV' } }), 'no', 'the other way too');

    // Ravens proposes to Hunters; Hunters declines; Ravens' log says so
    await c.eval(() => window.__GAL.ask('Hunters'));
    await until([a], () => !!window.__GAL.asks.g_gAlC3);
    await a.eval(() => window.__GAL.open()); await a.step(2);
    await opts(a); await pick(a, /Decline Ravens/);
    await until([a], () => !window.__GAL.asks.g_gAlC3);
    await until([c], () => Object.values(window.__GAL.log).some((e) => e.k === 'decline'));
    assert.match(await c.eval(() => window.__GAL.line(Object.values(window.__GAL.log).find((e) => e.k === 'decline'))), /^Hunters declined our proposal/);
    assert.equal(await c.eval(() => Object.keys(window.__GAL.all).length), 0);
    for (const g of [a, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/guildAlly write|guildAllyAsk write/.test(x))), []);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
