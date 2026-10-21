'use strict';
// SAT-ONLINE-086 (plan U239) over the fake Firebase with the rules' checks: guild wars. Hunters declares war on Wolves for
// a full hour ahead; Wolves accepts in G -> Wars and both are told. Before the hour no kill counts (the rules refuse it:
// a war can't start off-schedule), an hour not on the hour is refused, and it can't be called off once it is near. In the
// hour, Ahmed kills Bassem outside town: one for Hunters, no karma lost, no outlaw. At the end both are told the score.
// A second war is called off ahead of time; a declared war Wolves refuses is gone.
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
async function pages(g) {
  const out = [];
  for (let i = 0; i < 6; i++) { out.push(await g.eval(() => document.getElementById('dtext').textContent)); if (!(await g.eval(() => document.getElementById('dopts').hidden))) break; await g.eval(() => window.__G.advance()); await g.step(2); }
  return out.join(' / ');
}
async function shut(g) { for (let i = 0; i < 8 && (await g.eval(() => window.__G.mode)) === 'dialog'; i++) { await g.eval(() => { const o = [...document.querySelectorAll('#dopts button')]; if (document.getElementById('dopts').hidden || !o.length) window.__G.advance(); else o[o.length - 1].click(); }); await g.step(2); } }
const write = (g, u) => g.eval(async (x) => { const F = window.__GLD.fb(), D = F.m.database; for (const k in x) if (x[k] && x[k].t === 'SV') x[k].t = D.serverTimestamp(); try { await D.update(D.ref(F.db), x); return 'ok'; } catch (e) { return 'no'; } }, u);
// set a page's clock to t, running on from there (its Date.now, which the fake's rules use too)
const goTo = (g, t) => g.eval((x) => { if (!window.__now0) window.__now0 = Date.now; const b = window.__now0; window.__dt = x - b(); Date.now = () => b() + window.__dt; }, t);
async function strike(a, b) {
  const uid = await b.eval(() => Satisfy.local.net().uid);
  await a.eval(() => { window.__G.P.acd = 0; });
  const p = await a.eval((u) => { const r = Satisfy.local.net().remotes.find((x) => x.uid === u); return window.__G.toScreen(r.x, r.y - 11); }, uid);
  await a.page.mouse.click(p.x, p.y, { modifiers: [] });
  await a.step(1);
  await settle(a, b);
}
const place = (g, dx) => g.eval((d) => { const G = window.__G; G.P.x = 90 * 16 + d; G.P.y = 60 * 16; G.P.inv = 0; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } }, dx);
const HU = 'g_gWrA1', WO = 'g_gWrB2';

test('guild wars: declared for a set hour and accepted, kills count only in it and cost no karma, the score at the end', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gWrA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gWrB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await settle(a, b);
    for (const [g, n] of [[a, 'Hunters'], [b, 'Wolves']]) {
      await g.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 50000; });
      await g.eval((x) => window.__GG.create(x), n);
      await until([g], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    }
    await place(a, 0); await place(b, 18);
    await settle(a, b);

    // the hours offered: full hours from an hour ahead (09:40 UTC now: 11:00, 12:00, 13:00, 14:00, then tomorrow)
    const T = await a.eval(() => window.__GWR.times(Date.now()).map((o) => o.at));
    assert.equal(T.length, 8);
    assert.ok(T.every((x) => x % 3600000 === 0));
    assert.equal(new Date(T[0]).toISOString(), '2026-01-05T11:00:00.000Z');
    assert.equal(T[4] - T[0], 86400000);
    const at = T[0];
    // not on the hour: refused
    assert.equal(await write(a, { ['guildWarAsk/' + WO + '/' + HU]: { n: 'Hunters', at: at + 60000, by: 'gWrA1', t: 'SV' } }), 'no');

    // Hunters declares it; Wolves is told and accepts in G -> Wars
    await a.eval((x) => window.__GWR.declare('wolves', x), at);
    await until([b], () => !!window.__GWR.asks.g_gWrA1);
    await settle(a, b);
    assert.match(await toasts(b), /Hunters declares war on your guild \(G → Wars\)/);
    await b.eval(() => window.__GWR.open()); await b.step(2);
    assert.match(await pages(b), /^Guild wars \(0\) · No wars[^/]+ \/ ⚔ Hunters declares war for \d\d:00 \(UTC 11:00\)$/);
    await opts(b); await pick(b, /Accept the war with Hunters/);
    await until([a, b], () => Object.keys(window.__GWR.all).length === 1);
    await settle(a, b);
    for (const [g, o] of [[a, 'Wolves'], [b, 'Hunters']]) assert.match(await toasts(g), new RegExp('War with ' + o + ' at \\d\\d:00 \\(UTC 11:00\\)!'));
    await a.eval(() => window.__GWR.open()); await a.step(2);
    assert.match(await pages(a), /^Guild wars \(1\) · ⚔ Wolves: \d\d:00 \(UTC 11:00\), in 1 h \d+ min · 0 : 0/);
    assert.ok((await opts(a)).includes('Call off the war with Wolves'));
    await shut(a); await shut(b);

    // before the hour: no kill counts (the rules refuse it), and a near war can't be called off
    assert.equal(await write(a, { ['guildWarKill/' + HU + '/' + WO + '/gWrA1']: { n: 'Ahmed', k: 1, at, t: 'SV' } }), 'no', 'not before the war');
    for (const g of [a, b]) await goTo(g, at - 5 * 60000 + 20000);
    await settle(a, b);
    assert.match(await toasts(a), /War with Wolves in 5 min/);
    assert.equal(await a.eval(async (o) => { try { await window.__GWR.store().warOff('g_gWrA1', o); return 'ok'; } catch (e) { return 'no'; } }, WO), 'no', 'too near to call off');

    // in the hour: the war is on; Ahmed kills Bassem outside town: 1 : 0, no karma lost, no outlaw
    for (const g of [a, b]) await goTo(g, at + 60000);
    await settle(a, b);
    for (const [g, o] of [[a, 'Wolves'], [b, 'Hunters']]) assert.match(await toasts(g), new RegExp('The war with ' + o + ' has started! Kills outside towns count'));
    await until([a], () => !!window.__GWR.now('g_gWrB2'));
    await until([a], () => { const r = Satisfy.local.net().remotes.find((x) => x.uid === 'gWrB2'); return !!r && !!window.__GG.of(r.uid); }, 15000);
    await shut(a); await shut(b);
    const k0 = await a.eval(() => ({ karma: window.__G.S.karma || 0, ol: window.__G.S.olT || 0 }));
    await b.eval(() => { window.__G.P.hp = 1; window.__G.P.inv = 0; });
    for (let i = 0; i < 3 && (await b.eval(() => window.__G.mode)) !== 'dead'; i++) await strike(a, b);
    assert.equal(await b.eval(() => window.__G.mode), 'dead', await b.eval(() => document.getElementById('dialog').textContent));
    await until([a, b], () => { const s = window.__GWR.score(Satisfy.local.net().uid === 'gWrA1' ? 'g_gWrB2' : 'g_gWrA1'); return s[0] + s[1] === 1; }, 15000);
    assert.deepEqual(await a.eval(() => window.__GWR.score('g_gWrB2')), [1, 0]);
    assert.deepEqual(await b.eval(() => window.__GWR.score('g_gWrA1')), [0, 1]);
    assert.match(await toasts(a), /War kill! 1 : 0/);
    assert.deepEqual(await a.eval(() => ({ karma: window.__G.S.karma || 0, ol: window.__G.S.olT || 0 })), k0, 'no karma lost, no outlaw');
    assert.equal(await write(a, { ['guildWarKill/' + HU + '/' + WO + '/gWrA1']: { n: 'Ahmed', k: 201, at, t: 'SV' } }), 'no', 'at most 200');
    assert.equal(await write(b, { ['guildWarKill/' + HU + '/' + WO + '/gWrB2']: { n: 'Bassem', k: 5, at, t: 'SV' } }), 'no', 'only for your own guild');
    assert.equal(await a.eval(async (o) => { try { await window.__GWR.store().warOff('g_gWrA1', o); return 'ok'; } catch (e) { return 'no'; } }, WO), 'no', 'no leaving a war');

    // the end: both told the score
    for (const g of [a, b]) await goTo(g, at + 61 * 60000);
    await settle(a, b);
    assert.match(await toasts(a), /The war with Wolves is over: 1 : 0 · you won/);
    assert.match(await toasts(b), /The war with Hunters is over: 0 : 1 · you lost/);
    for (const g of [a, b]) await goTo(g, at + 66 * 60000);
    assert.equal(await write(a, { ['guildWarKill/' + HU + '/' + WO + '/gWrA1']: { n: 'Ahmed', k: 2, at, t: 'SV' } }), 'no', 'not after it (5 minutes late at most)');
    await shut(a);
    await a.eval(() => window.__GWR.open()); await a.step(2);
    assert.match(await pages(a), /⚔ Wolves: over · you won · 1 : 0/);
    await opts(a); await pick(a, /Clear the war with Wolves/);
    await until([a, b], () => Object.keys(window.__GWR.all).length === 0);

    // a second war, called off ahead of time; a third, refused
    const T2 = await a.eval(() => window.__GWR.times(Date.now()).map((o) => o.at));
    await a.eval((x) => window.__GWR.declare('Wolves', x), T2[2]);
    await until([b], () => !!window.__GWR.asks.g_gWrA1);
    await shut(b); await b.eval(() => window.__GWR.open()); await b.step(2);
    await opts(b); await pick(b, /Accept the war with Hunters/);
    await until([a, b], () => Object.keys(window.__GWR.all).length === 1);
    await a.eval((o) => window.__GWR.store().warOff('g_gWrA1', o), WO);
    await until([a, b], () => Object.keys(window.__GWR.all).length === 0);
    await a.eval((x) => window.__GWR.declare('Wolves', x), T2[3]);
    await until([b], () => !!window.__GWR.asks.g_gWrA1);
    await b.eval(() => window.__GWR.open()); await b.step(2);
    await opts(b); await pick(b, /Refuse the war with Hunters/);
    await until([b], () => !window.__GWR.asks.g_gWrA1);
    await until([a], () => Object.values(window.__GAL.log).some((e) => e.k === 'warno'));
    assert.match(await a.eval(() => window.__GAL.line(Object.values(window.__GAL.log).find((e) => e.k === 'warno'))), /^Wolves refused the war · \d\d:\d\d$/);
    assert.equal(await a.eval(() => Object.keys(window.__GWR.all).length), 0);
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/guildWarAsk values|guildWarKill|guildWar remove/.test(x))), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
