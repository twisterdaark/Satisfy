'use strict';
// SAT-ONLINE-090 (plan U246) over the fake Firebase with the rules' checks: guild seasons. A season is a calendar month; a
// guild earns each week the weekly-goal tier it reached. The owner's "/season 2026-01" gives gold (10 points), silver (6)
// and bronze (3) trophies; a week of another month doesn't count. The trophy shows by the guild's name and in G, and gives
// nothing in a fight. Nobody but the owner gives a trophy.
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
async function signIn(ctx, k, uid, name, look, admin) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n, a]) => { const D = window.__fakeRTDB.data; if (a) D.set('admins/' + u, true); D.set('accountIds/' + u, n); D.set('handles/' + n.toLowerCase(), u); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name, !!admin]);
  await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
  await H.newGame(g, look);
  await keepToasts(g);
  return g;
}
async function type(g, text) {
  await g.page.keyboard.press('Enter'); await g.step(1);
  await g.page.keyboard.type(text); await g.page.keyboard.press('Enter'); await g.step(2);
}
async function pages(g) {
  if (await g.eval(() => window.__GDW.on())) return g.eval(() => window.__GDW.lines()); // the guild window shows every line at once
  const out = [];
  for (let i = 0; i < 8; i++) { out.push(await g.eval(() => (window.__GDW.on() ? window.__GDW.text() : document.getElementById('dtext').textContent))); if (!(await g.eval(() => (document.getElementById('dopts').hidden && !document.querySelector('#gwB .gwopts button'))))) break; await g.eval(() => window.__G.advance()); await g.step(2); }
  return out;
}
async function shut(g) { for (let i = 0; i < 8 && (await g.eval(() => window.__G.mode)) === 'dialog'; i++) { await g.eval(() => { const o = [...document.querySelectorAll('#dopts button, #gwB .gwopts button')]; if ((document.getElementById('dopts').hidden && !document.querySelector('#gwB .gwopts button')) || !o.length) window.__G.advance(); else o[o.length - 1].click(); }); await g.step(2); } }
const write = (g, u) => g.eval(async (x) => { const F = window.__GLD.fb(), D = F.m.database; for (const k in x) if (x[k] && x[k].t === 'SV') x[k].t = D.serverTimestamp(); try { await D.update(D.ref(F.db), x); return 'ok'; } catch (e) { return 'no'; } }, u);
const HU = 'g_gSnA2';

test('guild seasons: a month of weekly-goal tiers gives gold, silver or bronze; shown by the name and in G; cosmetic only', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const own = await signIn(ctx, 'a', 'gSnO1', 'Twister', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }, true);
    const a = await signIn(ctx, 'b', 'gSnA2', 'Ahmed', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const b = await signIn(ctx, 'c', 'gSnB3', 'Bassem', { n: 'Zed', hair: 2, hc: 1, skin: 0, top: 2 });
    await settle(own, a, b);
    await a.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 50000; });
    await a.eval(() => window.__GG.create('Hunters'));
    await until([a], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    await b.eval(() => { window.__G.P.x += 30; });
    await settle(own, a, b);

    // the weeks of a season: those whose Monday is in the month
    const jan = await own.eval(() => window.__GMOD.ssnWeeks('2026-01'));
    assert.equal(jan.length, 4, 'Mondays 5, 12, 19, 26 January');
    assert.equal((await own.eval(() => window.__GMOD.ssnWeeks('2026-03'))).length, 5, 'March 2026 has five');
    const feb = (await own.eval(() => window.__GMOD.ssnWeeks('2026-02')))[0];
    // the month's weekly goals, as the members wrote them (each member counts up to 1,500): Hunters 3+3+2+2, Wolves
    // 2+2+1+1, Ravens 1+1+0+1, Owls 1; Hunters' tier 3 in February is another season
    await own.eval(([W, F]) => {
      const D = window.__fakeRTDB.data, k = (g, wk, kills) => kills.forEach((n, i) => D.set('guildWeek/' + g + '/' + wk + '/u' + i, { n: 'M' + i, k: n, t: 1 }));
      for (const [g, name] of [['g_wolves', 'Wolves'], ['g_ravens', 'Ravens'], ['g_owls', 'Owls']]) D.set('guilds/' + g, { name, nk: name.toLowerCase(), master: 'x', col: '#5aa0ff', t: 1 });
      const T = { 3: [1500, 1500], 2: [1000], 1: [300], 0: [100] };
      [3, 3, 2, 2].forEach((tier, i) => k('g_gSnA2', W[i], T[tier]));
      [2, 2, 1, 1].forEach((tier, i) => k('g_wolves', W[i], T[tier]));
      [1, 1, 0, 1].forEach((tier, i) => k('g_ravens', W[i], T[tier]));
      k('g_owls', W[0], T[1]); k('g_gSnA2', F, [1500, 1500]);
    }, [jan, feb]);
    assert.deepEqual(await own.eval((w) => window.__GMOD.ssnPoints(Object.fromEntries(['g_gSnA2', 'g_owls'].map((g) => [g, Object.fromEntries(w.map((wk) => [wk, { u0: { k: 1500 }, u1: { k: g === 'g_owls' ? 99999 : 1500 } }]))])), '2026-01'), jan), { g_gSnA2: 12, g_owls: 12 }, 'each member up to 1,500');

    // nobody but the owner gives a trophy
    assert.equal(await write(a, { ['guildTrophy/' + HU + '/s2026-01']: { k: 'gold', p: 99, by: 'gSnA2', t: 'SV' } }), 'no');
    await type(a, '/season 2026-01');
    await until([a], () => /Only the game's owner can do that/.test(window.__toastSeen));
    await type(own, '/season 2026-13');
    await until([own], () => /Type: \/season or \/season 2026-10/.test(window.__toastSeen));

    // the owner closes January
    const before = await a.eval(() => ({ atk: window.__G.eqx.atkV(), def: window.__G.eqx.defV(), cd: window.__G.eqx.atkCD() }));
    await type(own, '/season 2026-01'); await own.step(2);
    await until([own], () => /Season 2026-01:/.test(document.getElementById('dialog').textContent));
    assert.deepEqual(await pages(own), ['Season 2026-01: 🏆 Hunters (10) · 🥈 Wolves (6) · 🥉 Ravens (3)']);
    await shut(own);
    await until([a, b], () => { const v = window.__fakeRTDB.data.get('guildTrophy/g_gSnA2/s2026-01'); return !!v && v.k === 'gold' && v.p === 10; });
    assert.equal(await own.eval(() => window.__fakeRTDB.data.has('guildTrophy/g_owls/s2026-01')), false, 'one point: no trophy');

    // shown: by Hunters' name on another screen, and in G for its master; nothing changes in a fight
    for (const g of [a, b]) await g.eval(() => window.__GMOD.troClear()); // read again now (the game reads a guild's every 5 minutes)
    await until([b], () => { const L = window.__GMOD.tro('g_gSnA2'); return !!L && L[0].k === 'gold'; });
    await until([a], () => !!window.__GMOD.tro('g_gSnA2'));
    await a.page.keyboard.press('KeyG'); await a.step(2); await a.eval(() => window.__GDW.tab('x')); await a.step(2);
    assert.ok((await pages(a)).includes('Trophies: 🏆 2026-01'), 'in G');
    await shut(a);
    assert.deepEqual(await a.eval(() => ({ atk: window.__G.eqx.atkV(), def: window.__G.eqx.defV(), cd: window.__G.eqx.atkCD() })), before, 'no fight advantage');
    for (const g of [own, a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/guildTrophy/.test(x))), []);
    for (const g of [own, a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
