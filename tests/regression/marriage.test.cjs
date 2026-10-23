'use strict';
// Marriage (owner 2026-10-23: "a Marriage System with benefits between players"): two players marry before a priest of
// Rebecca. One proposes (10,000 gold), the other says yes; both get a Wedding Ring, and near each other they gain XP,
// damage and health. Couple Recall takes you to your spouse; a divorce reaches the other side.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 10; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
const atPriest = (g, dx) => g.eval((dx) => { const G = window.__G, n = G.npcs.find((x) => x.id === 'priestT'); G.P.x = n.x + dx; G.P.y = n.y + 14; G.S.lv = 30; }, dx);

test('a proposal, the yes, the rings, the bond near each other, Couple Recall and a divorce', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 3, hc: 0, skin: 1, top: 1 });
    await H.newGame(b, { n: 'Irene', g: 1, hair: 12, hc: 6, skin: 0, top: 3 });
    await atPriest(a, -10); await atPriest(b, 10);
    await settle(a, b);
    // Grid proposes at the Great Temple's priest
    const p = await a.eval(() => { const G = window.__G, S = G.S, o = window.__GMAR.opts('priestT'); S.gold = 25000; const pr = o.find((x) => /Propose to Irene/.test(x.l)); if (pr) pr.f(); return { l: o.map((x) => x.l), gold: S.gold, pub: window.__GMAR.pub() }; });
    assert.equal(p.gold, 15000, JSON.stringify(p));
    assert.match(p.pub, /^p/);
    await settle(a, b);
    // Irene is asked and says yes
    const q = await b.eval(() => { const G = window.__G, D = G.DL; const o = D && D.opts || []; const y = o.findIndex((x) => x.l === 'Yes, I do'); const text = document.getElementById('dtext').textContent; if (y >= 0) G.pickOpt(y); return { y, text }; });
    assert.ok(q.y >= 0, 'Irene is asked: ' + JSON.stringify(q));
    await settle(a, b);
    const m = await Promise.all([a, b].map((g) => g.eval(() => { const S = window.__G.S; return { mar: S.mar && S.mar.n, ring: S.items.some((i) => i.id === 'wring'), near: window.__GMAR.near(), dm: window.__GMAR.b('dm') }; })));
    assert.deepEqual(m.map((x) => x.mar), ['Irene', 'Grid']);
    assert.ok(m.every((x) => x.ring), 'both get a Wedding Ring');
    assert.ok(m.every((x) => x.near && x.dm >= 0.05), 'the bond near each other: ' + JSON.stringify(m));
    // the ring on doubles it; far apart it is gone
    const r = await a.eval(() => { const G = window.__G, X = G.eqx, it = G.S.items.find((i) => i.id === 'wring'); X.equip(it); return window.__GMAR.b('dm'); });
    assert.ok(Math.abs(r - 0.1) < 1e-9, 'twice with the ring: ' + r);
    await b.eval(() => { window.__G.P.x += 900; });
    await settle(a, b);
    assert.equal(await a.eval(() => window.__GMAR.near()), false);
    // Couple Recall: Grid goes to Irene, then waits 30 minutes
    const g1 = await a.eval(() => { const P = window.__G.P, x0 = P.x; window.__GMAR.go(); const d1 = P.x - x0; const cd = window.__G.S.marCd > Date.now(); return { d1, cd }; });
    assert.ok(g1.d1 > 800 && g1.cd, JSON.stringify(g1));
    // Irene divorces; Grid is told
    await b.eval(() => { window.__G.S.gold = 9000; window.__GMAR.div('priestT'); });
    await settle(a, b);
    const d = await Promise.all([a, b].map((g) => g.eval(() => { const S = window.__G.S; return { mar: !!S.mar, gold: S.gold }; })));
    assert.equal(d[0].mar, false, 'the divorce reaches Grid'); assert.equal(d[1].mar, false); assert.equal(d[1].gold, 4000);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
