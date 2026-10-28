'use strict';
// v3.77 (plan U237) the guild research tree online, over the fake Firebase with the rules' checks. A founds a guild and B
// joins; A fills the treasury and researches Training Manuals, then Endurance Drills after it (each taken from the
// treasury); B's game applies both (experience, max health) and the research board shows them done; B, a member, can't
// research, nor can a node be bought out of its branch's order or twice.
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
const bank = (g) => g.eval(() => window.__GBD.bank());

test('online guild research: nodes bought from the treasury in their branch\'s order, applied for every member', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const P = {};
    for (const [k, uid, name, look] of [['a', 'gGrA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }], ['b', 'gGrB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 }]]) {
      const g = P[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
      await H.newGame(g, look);
      await keepToasts(g);
    }
    const { a, b } = P;
    await b.eval(() => { window.__G.P.x += 20; });
    await a.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 1005000; });
    await settle(a, b);
    await a.eval(() => window.__GG.create('Scholars'));
    await until([a], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    await a.eval(() => { const r = Satisfy.local.net().remotes.find((x) => x.uid === 'gGrB2'); window.__G.P.x = r.x - 16; window.__G.P.y = r.y; });
    await a.step(3); await a.page.keyboard.press('KeyT'); await a.step(2);
    await a.eval(() => document.querySelector('#pctx [data-act="pcGuild"]').click());
    await until([b], () => !document.getElementById('guildInv').hidden);
    await b.eval(() => document.querySelector('#guildInv [data-act="gdYes"]').click());
    await until([b], () => { const s = window.__GG.state(); return !!s && s.rank === 'r'; });
    await until([a, b], () => !!window.__GBD.bank());
    for (const g of [100000, 100000, 100000]) { await a.eval((x) => window.__GBD.give(x), g); await settle(a, b); }
    await a.eval(() => window.__GBD.give(100000)); await settle(a, b);
    await until([a, b], () => (window.__GBD.bank() || {}).in === 400000);
    const base = await b.eval(() => ({ xp: window.__GBD.xpB(), hp: window.__GGR.hp(), m: window.__GGR.m() }));
    assert.equal(base.m, 0, 'nothing researched');

    // B, a member, can't research: not from the game, not with a direct write
    await b.eval(() => window.__GGR.buy(0)); await settle(a, b);
    const direct = await b.eval(async () => { try { await window.__GBD.store().research('g_gGrA1', 'gGrB2', 'Bassem', 'grx1', 0, 100000, 'l_test1'); return 'ok'; } catch (e) { return 'no'; } });
    assert.equal(direct, 'no');
    // a node out of its branch's order: refused (the game doesn't offer it; a direct write the rules refuse)
    const early = await a.eval(async () => { try { await window.__GBD.store().research('g_gGrA1', 'gGrA1', 'Ahmed', 'grh', 3, 250000, 'l_test2'); return 'ok'; } catch (e) { return 'no'; } });
    assert.equal(early, 'no');
    assert.equal(await a.eval(() => window.__GGR.m()), 0);

    // A researches Training Manuals, then Endurance Drills; the treasury pays; B's game applies both
    await a.eval(() => window.__GGR.buy(0)); await settle(a, b);
    await until([a, b], () => window.__GGR.m() === 1);
    assert.deepEqual(await bank(a), { in: 400000, s: 100000 });
    await a.eval(() => window.__GGR.buy(0)); await settle(a, b);   // again: nothing (it's done)
    assert.deepEqual(await bank(a), { in: 400000, s: 100000 });
    await a.eval(() => window.__GGR.buy(3)); await settle(a, b);
    await until([a, b], () => window.__GGR.m() === 9);
    assert.deepEqual(await bank(b), { in: 400000, s: 350000 });
    const now = await b.eval(() => ({ xp: window.__GBD.xpB(), hp: window.__GGR.hp(), lf: window.__GGR.b('lf') }));
    assert.ok(Math.abs(now.xp - base.xp - 0.02) < 1e-9, '+2% experience: ' + base.xp + ' → ' + now.xp);
    assert.ok(Math.abs(now.hp - base.hp * 1.03) <= 1, '+3% max health: ' + base.hp + ' → ' + now.hp);
    assert.equal(now.lf, 0, 'nothing for life skills yet');
    assert.match(await toasts(b), /The guild finished researching Endurance Drills/);
    // the treasury can't pay for the next one: refused before any write
    await a.eval(() => window.__GGR.buy(6)); await settle(a, b);
    assert.match(await toasts(a), /Not enough in the treasury/);

    // the board: two done, the next in each branch with its cost, the rest waiting on the one before
    await b.eval(() => window.__GGR.open()); await b.step(3);
    for (let i = 0; i < 4 && await b.eval(() => document.getElementById('dopts').hidden); i++) { await b.eval(() => window.__G.advance()); await b.step(2); }
    const txt = await b.eval(() => document.getElementById('dialog').textContent);
    assert.match(txt, /Training Manuals: \+2% experience · ✓ done/);
    assert.match(txt, /War College: \+3% experience · 600,000 gold/);
    assert.match(txt, /Trade Charter: \+3% gold from monsters · needs Armoury first/);
    assert.deepEqual(await b.eval(() => [...document.querySelectorAll('#dopts button')].map((x) => x.textContent.replace(/^\d+\.\s*/, ''))).then((L) => L.filter((x) => /^Research/.test(x))), [], 'a member sees no research to buy');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
