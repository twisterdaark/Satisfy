'use strict';
// v3.68 (plan U207) guild supply orders online, over the fake Firebase with the rules' checks. A founds a guild, B joins, A
// fills the treasury and asks for 50 ore at 3 gold a piece. B, a member, delivers: 50 of his 80 ore go into the guild vault,
// 150 gold from the treasury to him, the order complete; he can't deliver to it again, nor post an order himself; A takes
// it off.
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

test('online guild supply orders: asked by the master, delivered by a member into the vault, paid from the treasury', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const P = {};
    for (const [k, uid, name, look] of [['a', 'gSpA1', 'Ahmed', { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 }], ['b', 'gSpB2', 'Bassem', { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 }]]) {
      const g = P[k] = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
      await H.newGame(g, look);
      await keepToasts(g);
    }
    const { a, b } = P;
    await b.eval(() => { window.__G.P.x += 20; });
    await a.eval(() => { const S = window.__G.S; S.lv = 60; S.gold = 105000; });
    await b.eval(() => { const S = window.__G.S; S.gold = 1000; S.mats.ore = 80; });
    await settle(a, b);
    await a.eval(() => window.__GG.create('Suppliers'));
    await until([a], () => { const s = window.__GG.state(); return !!s && s.rank === 'm'; });
    await a.eval(() => { const r = Satisfy.local.net().remotes.find((x) => x.uid === 'gSpB2'); window.__G.P.x = r.x - 16; window.__G.P.y = r.y; });
    await a.step(3); await a.page.keyboard.press('KeyT'); await a.step(2);
    await a.eval(() => document.querySelector('#pctx [data-act="pcGuild"]').click());
    await until([b], () => !document.getElementById('guildInv').hidden);
    await b.eval(() => document.querySelector('#guildInv [data-act="gdYes"]').click());
    await until([b], () => { const s = window.__GG.state(); return !!s && s.rank === 'r'; });
    await until([a, b], () => !!window.__GBD.bank());
    await a.eval(() => window.__GBD.give(100000)); await settle(a, b);
    await until([a, b], () => (window.__GBD.bank() || {}).in === 100000);
    assert.ok(await a.eval(() => window.__GSUP.mats().includes('ore')), 'ore is among what may be asked for');

    // B, a member, can't post an order: not from the game, not with a direct write
    await b.eval(() => window.__GSUP.post('ore', 50, 3)); await settle(a, b);
    const direct = await b.eval(async () => { try { await window.__GBD.store().supPost('g_gSpA1', 's1', { k: 'ore', n: 5, p: 3, id: 'zzzzzz', by: 'gSpB2' }); return 'ok'; } catch (e) { return 'no'; } });
    assert.equal(direct, 'no');
    assert.deepEqual(await a.eval(() => Object.keys(window.__GSUP.O)), []);

    // A asks for 50 ore at 3 gold; B delivers 50 of his 80
    await a.eval(() => window.__GSUP.post('ore', 50, 3)); await settle(a, b);
    await until([a, b], () => !!window.__GSUP.O.s0);
    await b.eval(() => window.__GSUP.open()); await b.step(3);
    for (let i = 0; i < 4 && await b.eval(() => document.getElementById('dopts').hidden); i++) { await b.eval(() => window.__G.advance()); await b.step(2); }
    const txt = await b.eval(() => document.getElementById('dialog').textContent);
    assert.match(txt, /Ore: 0\/50 · 3 gold each/i);
    const give = (await b.eval(() => [...document.querySelectorAll('#dopts button')].map((x) => x.textContent))).find((x) => /Deliver 50/.test(x));
    assert.ok(give, 'the delivery offered');
    await b.eval(() => window.__GSUP.give('s0')); await settle(a, b);
    await until([b], () => /You delivered 50 .* and got 150 gold/.test(window.__toastSeen), 15000);
    assert.deepEqual(await b.eval(() => { const S = window.__G.S; return [S.gold, S.mats.ore]; }), [1150, 30]);
    await until([a, b], () => (window.__GSUP.O.s0 || {}).d === 50 && (window.__GBD.bank() || {}).s === 150);
    const vault = await a.eval(() => Object.values(window.__GG.vault()).filter((e) => e.k === 'ore').map((e) => [e.n, e.byN]));
    assert.deepEqual(vault, [[50, 'Bassem']], 'in the guild vault');
    // complete: no delivery offered, and none taken again
    await b.eval(() => window.__GSUP.open()); await b.step(3);
    for (let i = 0; i < 4 && await b.eval(() => document.getElementById('dopts').hidden); i++) { await b.eval(() => window.__G.advance()); await b.step(2); }
    assert.ok(!(await b.eval(() => [...document.querySelectorAll('#dopts button')].some((x) => /Deliver/.test(x.textContent)))));
    assert.match(await b.eval(() => document.getElementById('dialog').textContent), /Ore: 50\/50 · 3 gold each · complete/i);
    // A takes it off
    await a.eval(() => window.__GSUP.cancel('s0')); await settle(a, b);
    await until([a, b], () => !window.__GSUP.O.s0);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
