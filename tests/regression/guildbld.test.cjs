'use strict';
// SAT-ONLINE-065 (Claude-B #13 item 21): guild buildings online, over the fake Firebase with the rules' checks. A founds a
// guild and B joins; both give gold to the treasury (two gifts at once both count); A raises the Guild Forge and the
// Training Hall from it; B's game applies them; B, a member, can't build.
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
const toasts = (g) => g.eval(() => document.getElementById('toasts').textContent);
const bank = (g) => g.eval(() => window.__GBD.bank());

test('online guild buildings: gifts to the treasury, buildings raised from it, applied for every member', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const P = {};
    for (const [k, uid, name, look] of [['a', 'gGbA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }], ['b', 'gGbB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 }]]) {
      const g = P[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
      await H.newGame(g, look);
    }
    const { a, b } = P;
    await b.eval(() => { window.__G.P.x += 20; });
    await a.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 305000; });
    await b.eval(() => { window.__G.S.gold = 5000; });
    await settle(a, b);
    await a.eval(() => window.__GG.create('Builders'));
    await until([a], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    // A invites B from B's card; B joins from the prompt
    await a.eval(() => { const r = Satisfy.local.net().remotes.find((x) => x.uid === 'gGbB2'); window.__G.P.x = r.x - 16; window.__G.P.y = r.y; });
    await a.step(3); await a.page.keyboard.press('KeyT'); await a.step(2);
    await a.eval(() => document.querySelector('#pctx [data-act="pcGuild"]').click());
    await until([b], () => !document.getElementById('guildInv').hidden);
    await b.eval(() => document.querySelector('#guildInv [data-act="gdYes"]').click());
    await until([b], () => { const s = window.__GG.state(); return !!s && s.rank === 'r'; });
    await until([a, b], () => !!window.__GBD.bank());
    assert.deepEqual(await bank(b), { in: 0, s: 0 }, 'an empty treasury');

    // gifts: A twice, B once; the gold leaves the bags and the treasury adds them up
    await a.eval(() => window.__GBD.give(100000)); await settle(a, b);
    await a.eval(() => window.__GBD.give(100000)); await settle(a, b);
    await b.eval(() => window.__GBD.give(1000)); await settle(a, b);
    await until([a, b], () => (window.__GBD.bank() || {}).in === 201000);
    assert.equal(await a.eval(() => window.__G.S.gold), 100000, '305,000 - 5,000 for the guild - 200,000 given');
    assert.equal(await b.eval(() => window.__G.S.gold), 4000);
    assert.match(await toasts(b), /You gave 1,000 gold to the guild treasury/);
    // two gifts at once both count (the later one is refused once and tried again)
    await Promise.all([a.eval(() => window.__GBD.give(1000)), b.eval(() => window.__GBD.give(1000))]);
    await until([a, b], () => (window.__GBD.bank() || {}).in === 203000, 15000);

    // B, a member, can't build: not from the game, not with a direct write
    const xp0 = await b.eval(() => window.__GBD.xpB());
    await b.eval(() => window.__GBD.build('forge')); await settle(a, b);
    const direct = await b.eval(async () => { try { await window.__GBD.store().build('g_gGbA1', 'gGbB2', 'Bassem', 'forge', 1, 50000, 'l_test1'); return 'ok'; } catch (e) { return 'no'; } });
    assert.equal(direct, 'no');
    assert.equal(await b.eval(() => window.__GBD.lv('forge')), 0);
    // A raises the Guild Forge and the Training Hall; B's game applies both
    await a.eval(() => window.__GBD.build('forge')); await settle(a, b);
    await until([a, b], () => window.__GBD.lv('forge') === 1);
    await a.eval(() => window.__GBD.build('train')); await settle(a, b);
    await until([a, b], () => window.__GBD.lv('train') === 1);
    assert.deepEqual(await bank(b), { in: 203000, s: 100000 });
    assert.equal(await b.eval(() => window.__GBD.q()), 0.02, 'crafting quality +2%');
    assert.equal(Math.round(((await b.eval(() => window.__GBD.xpB())) - xp0) * 100), 3, 'experience +3%');
    assert.match(await toasts(b), /Guild Forge is now level 1!/);
    // the treasury can't pay for more than it has: level 2 of the forge (150,000) after 100,000 spent of 203,000
    await a.eval(() => window.__GBD.build('forge')); await settle(a, b);
    assert.equal(await a.eval(() => window.__GBD.lv('forge')), 1);
    assert.match(await toasts(a), /Not enough in the treasury/);
    // the master can't burn the treasury without raising a building (Claude-B's review of #99)
    const burn = await a.eval(async () => {
      const F = window.__GBD.fb(), D = F.m.database, v = window.__fakeRTDB.data.get('guildBank/g_gGbA1');
      try { await D.update(D.ref(F.db), { 'guildBank/g_gGbA1': { in: v.in, s: v.s + 50000, lb: v.lb, lg: v.lg, t: D.serverTimestamp() } }); return 'ok'; } catch (e) { return 'no'; }
    });
    assert.equal(burn, 'no');
    // the dialog and the log
    await b.eval(() => window.__GBD.open()); await b.step(2);
    assert.match(await b.eval(() => document.getElementById('dialog').textContent), /Guild treasury: 103,000 gold/);
    const log = await a.eval(() => Object.values(window.__GBD.log() || {}).map((x) => x.k + ':' + (x.b || x.g)).sort());
    assert.ok(log.includes('build:forge') && log.includes('build:train') && log.includes('give:100000'), log.join(' '));
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/guildBank stale|guildBuild|guildNames taken/.test(x))), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
