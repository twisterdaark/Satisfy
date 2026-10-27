'use strict';
// Plan U293 (2026-10-26): dancing together on Patrian's stage. Players who start in the same 8-second window of the world
// clock dance the same ten arrows, and each partner who danced beside you adds 20% to what the crowd throws.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) { for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); } }
const onStage = (g) => g.eval(() => { const G = window.__G, T = window.__GP4.STG; G.P.x = T.cx * 16; G.P.y = T.cy * 16 + 8; G.S.gold = 0; G.P.inv = 1e9; });
const dance = (g) => g.eval(() => { const D = window.__GP4.P4.dance, g0 = window.__G.S.gold; for (let i = 0; i < 10; i++) { D.gap = 0; D.t = 1e9; window.__GP4.step(D.seq[D.i]); } return { ok: D.ok, mates: D.mates, gold: window.__G.S.gold - g0 }; });

test('two dancers share the arrows and the crowd throws 20% more', async () => {
  const ctx = await H.newContext({});
  const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
  const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
  try {
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await onStage(a); await onStage(b); await settle(a, b);
    // wait for the start of a window, so both start inside it
    await a.eval(() => new Promise((ok) => { const w = () => (Date.now() % 8000 < 4000 ? ok() : setTimeout(w, 100)); w(); }));
    const sa = await a.eval(() => { window.__GP4.act({ k: 'p4stage' }); window.__GP4.P4.dance.t = 1e9; return { seq: window.__GP4.P4.dance.seq.join(''), st: window.__GU070.st() }; });
    assert.match(sa.st, /d/, 'a dancer shows it');
    let m = 0;
    for (let i = 0; i < 30 && !m; i++) { await settle(a, b); m = await b.eval(() => window.__GP4.mates()); }
    assert.equal(m, 1, 'B sees A dancing');
    const sb = await b.eval(() => { window.__GP4.act({ k: 'p4stage' }); const D = window.__GP4.P4.dance; D.t = 1e9; return { seq: D.seq.join(''), mates: D.mates, x: window.__G.P.x }; });
    assert.equal(sb.seq, sa.seq, 'the same ten arrows');
    assert.equal(sb.mates, 1); assert.equal(sb.x, (await a.eval(() => window.__GP4.STG.cx)) * 16 - 18, 'B steps beside A');
    for (let i = 0; i < 30 && !(await a.eval(() => window.__GP4.P4.dance.mates)); i++) await settle(a, b);
    const ra = await dance(a), rb = await dance(b);
    assert.deepEqual([ra.ok, ra.mates, ra.gold], [10, 1, 960], 'a perfect dance with one partner: 800 and 20%');
    assert.deepEqual([rb.ok, rb.mates, rb.gold], [10, 1, 960]);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
