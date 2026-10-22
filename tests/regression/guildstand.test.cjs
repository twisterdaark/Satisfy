'use strict';
// SAT-ONLINE-123 (plan U245, "faction standings") over the fake Firebase with the rules' checks: the standing between two
// guilds, from the diplomacy log and what is in force, the same on both sides. Hunters and Wolves ally (allied, +70, 🤝 by
// the name); Wolves breaks it: both are hostile (-30) and carry 💢 by the other's name; G -> Diplomacy -> Standings lists
// it with the formula. Ravens' proposal is declined (neutral, -5), and its next proposal shows that. Wolves declares war:
// Hunters sees the standing by it; accepted, the two are at war (💢 before the hour, ⚔ in it). No new data, no refusals.
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
async function signIn(ctx, k, uid, name, look) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
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
const goTo = (g, t) => g.eval((x) => { if (!window.__now0) window.__now0 = Date.now; const b = window.__now0; window.__dt = x - b(); Date.now = () => b() + window.__dt; }, t);
const place = (g, dx) => g.eval((d) => { const G = window.__G; G.P.x = 90 * 16 + d; G.P.y = 60 * 16; G.P.inv = 0; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } }, dx);
const of = (g, gid) => g.eval((x) => { const s = window.__GST.of(x); return s && { k: s.k, pts: s.pts }; }, gid);
const HU = 'g_gStA1', WO = 'g_gStB2', RA = 'g_gStC3';

test('guild standings: allied, broken to hostile on both sides and marked, listed with the formula; declined; at war', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await signIn(ctx, 'a', 'gStA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await signIn(ctx, 'b', 'gStB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const c = await signIn(ctx, 'c', 'gStC3', 'Carim', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await settle(a, b, c);
    for (const [g, n] of [[a, 'Hunters'], [b, 'Wolves'], [c, 'Ravens']]) {
      await g.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 50000; });
      await g.eval((x) => window.__GG.create(x), n);
      await until([g], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    }
    await place(a, 0); await place(b, 18); await place(c, 400);
    await settle(a, b, c);
    assert.equal(await of(a, WO), null, 'no dealings yet');
    await a.eval(() => window.__GAL.open()); await a.step(2);
    await opts(a); await pick(a, /^(\d+\.\s*)?Standings$/); await a.step(2);
    assert.match(await pages(a), /^Standings with other guilds \(the last 30 days\) · No dealings with other guilds in the last 30 days: every guild is neutral \/ How: each event of the last 30 days counts once: an alliance made \+20, ended in order or ran out \+10, broken -50, a proposal declined -5, a war fought -30, a war refused -10; an alliance in force \+50\. 25 and up is friendly, -25 and down hostile\./);
    await shut(a);

    // allied: +20 made, +50 in force, on both sides; 🤝 by Wolves' name over Bassem
    await a.eval(() => window.__GAL.ask('wolves'));
    await until([b], () => !!window.__GAL.asks.g_gStA1);
    await b.eval(() => window.__GAL.open()); await b.step(2);
    assert.match(await pages(b), /📜 Hunters asks for an alliance$/, 'no history: no standing by the proposal');
    await opts(b); await pick(b, /^(\d+\.\s*)?Accept Hunters/);
    await until([a, b], () => Object.keys(window.__GAL.all).length === 1);
    await until([a], () => Object.values(window.__GAL.log).some((e) => e.k === 'ally'));
    await until([b], () => Object.values(window.__GAL.log).some((e) => e.k === 'ally'));
    assert.deepEqual(await of(a, WO), { k: 'ally', pts: 70 });
    assert.deepEqual(await of(b, HU), { k: 'ally', pts: 70 });
    await shut(a); await shut(b);
    await until([a], () => !!window.__GG.of('gStB2'), 15000);
    assert.equal(await a.eval(() => window.__GST.tag('gStB2')), '«Wolves» 🤝');

    // Wolves breaks it: -30 on both sides, hostile, 💢 by the name both ways
    await b.eval(() => window.__GAL.open()); await b.step(2);
    await opts(b); await pick(b, /End the alliance with Hunters/); await b.step(2);
    await opts(b); await pick(b, /^(\d+\.\s*)?Yes/);
    await until([a, b], () => Object.keys(window.__GAL.all).length === 0);
    await until([a, b], () => Object.values(window.__GAL.log).some((e) => e.k === 'break'));
    assert.deepEqual(await of(a, WO), { k: 'hostile', pts: -30 });
    assert.deepEqual(await of(b, HU), { k: 'hostile', pts: -30 });
    await shut(a); await shut(b);
    await until([b], () => !!window.__GG.of('gStA1'), 15000);
    assert.equal(await a.eval(() => window.__GST.tag('gStB2')), '«Wolves» 💢');
    assert.equal(await b.eval(() => window.__GST.tag('gStA1')), '«Hunters» 💢');
    assert.equal(await c.eval(() => window.__GST.of('g_gStA1')), null, 'Ravens had no dealings with either');

    // Ravens' proposal is declined: -5, neutral, shown by its next one; Standings lists both, best first
    await c.eval(() => window.__GAL.ask('Hunters'));
    await until([a], () => !!window.__GAL.asks.g_gStC3);
    await a.eval(() => window.__GAL.open()); await a.step(2);
    await opts(a); await pick(a, /Decline Ravens/);
    await until([a], () => !window.__GAL.asks.g_gStC3 && Object.values(window.__GAL.log).some((e) => e.k === 'decline'));
    await until([c], () => Object.values(window.__GAL.log).some((e) => e.k === 'decline'));
    assert.deepEqual(await of(c, HU), { k: 'neutral', pts: -5 });
    await shut(a);
    await c.eval(() => window.__GAL.ask('Hunters'));
    await until([a], () => !!window.__GAL.asks.g_gStC3);
    await a.eval(() => window.__GAL.open()); await a.step(2);
    assert.match(await pages(a), /📜 Ravens asks for an alliance \(standing: neutral -5\)/);
    await opts(a); await pick(a, /^(\d+\.\s*)?Standings$/); await a.step(2);
    assert.match(await pages(a), /^Standings with other guilds \(the last 30 days\) · Ravens: neutral \(-5\) · declined ×1 · Wolves: hostile \(-30\) · alliance made ×1, broken ×1 \/ How: /);
    await shut(a);

    // Wolves declares war; Hunters sees the standing by it and accepts: at war, 💢 before the hour and ⚔ in it
    const at = (await b.eval(() => window.__GWR.times(Date.now())))[0].at;
    await b.eval((x) => window.__GWR.declare('hunters', x), at);
    await until([a], () => !!window.__GWR.asks.g_gStB2);
    await a.eval(() => window.__GWR.open()); await a.step(2);
    assert.match(await pages(a), /⚔ Wolves declares war for \d\d:00 \(UTC \d\d:00\) \(standing: hostile -30\)$/);
    await opts(a); await pick(a, /Accept the war with Wolves/);
    await until([a, b], () => Object.keys(window.__GWR.all).length === 1);
    await until([a, b], () => Object.values(window.__GAL.log).some((e) => e.k === 'war'));
    assert.deepEqual(await of(a, WO), { k: 'war', pts: -60 });
    assert.deepEqual(await of(b, HU), { k: 'war', pts: -60 });
    assert.equal(await a.eval(() => window.__GST.tag('gStB2')), '«Wolves» 💢');
    await shut(a);
    for (const g of [a, b]) await goTo(g, at + 60000);
    await settle(a, b);
    assert.equal(await a.eval(() => window.__GST.tag('gStB2')), '«Wolves» ⚔');
    // after the hour: hostile, -60, until the month passes
    for (const g of [a, b]) await goTo(g, at + 3600000 + 60000);
    await settle(a, b);
    assert.deepEqual(await of(a, WO), { k: 'hostile', pts: -60 });
    for (const g of [a, b]) await goTo(g, at + 31 * 86400000);
    await settle(a, b);
    assert.equal(await of(a, WO), null, 'a month later every entry is done');

    for (const g of [a, b, c]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b, c]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
