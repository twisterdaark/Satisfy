'use strict';
// The boss damage meter (owner 2026-10-26, from the player Soki): under a boss's bar, each player's share of the damage in %
// and whether it is enough for the credit (5% of its health); a boss fought by more than one player gives 10% more XP.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('alone: you 100% with the credit, no co-op XP', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, P = G.P, B = window.__GBDM, m = G.mons().find((x) => x.type === 'gchief' && !x.dead);
      m.stun = 1e9; P.x = m.x - 40; P.y = m.y; B.tick();
      m.hp -= Math.round(m.max * .03); m.myd = (m.myd || 0) + Math.round(m.max * .03); B.tick();
      const few = B.rows(m)[0];
      m.hp -= Math.round(m.max * .05); m.myd += Math.round(m.max * .05); B.tick(); B.show(m);
      const r = B.rows(m);
      return { few: few.ok, n: r.length, p: r[0].p, ok: r[0].ok, coop: B.coop(m), html: document.getElementById('bdm').textContent };
    });
    assert.equal(r.few, false, '3% is not enough');
    assert.deepEqual([r.n, r.p, r.ok, r.coop], [1, 1, true, 0]);
    assert.match(r.html, /you100%✓/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

const frames = async (gs, n) => { for (let k = 0; k < n; k++) { for (const g of gs) await g.step(2); await gs[0].page.waitForTimeout(12); } };
async function online(ctx, k, uid, name) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  for (let i = 0; i < 80 && !(await g.eval(() => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE')); i++) { await g.step(3); await g.page.waitForTimeout(30); }
  return g;
}
async function until(gs, fn, ms = 12000) {
  const end = Date.now() + ms;
  for (;;) { if (await fn()) return; if (Date.now() > end) throw new Error('timed out: ' + fn); await frames(gs, 5); }
}
const rows = (g) => g.eval(() => { const m = window.__G.mons().find((x) => x.type === 'gchief' && !x.dead); window.__GBDM.tick(); return window.__GBDM.rows(m).map((r) => ({ me: !!r.me, p: Math.round(r.p * 100), ok: r.ok })); });

test('two players: both see both shares, and the kill gives 10% more XP', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await online(ctx, 'a', 'gBmA1', 'Ahmed');
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await online(ctx, 'b', 'gBmB2', 'Bassem'); // arrives second: A hosts
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    for (const g of [a, b]) await g.eval(() => window.__GMEET.stop());
    const spot = await a.eval(() => { const G = window.__G, m = G.mons().find((x) => x.type === 'gchief' && !x.dead); m.stun = 1e9; G.P.x = m.sx - 40; G.P.y = m.sy; G.P.inv = 1e9; return { x: m.sx, y: m.sy }; });
    await b.eval((s) => { const G = window.__G, m = G.mons().find((x) => x.type === 'gchief' && !x.dead); if (m) m.stun = 1e9; G.P.x = s.x - 60; G.P.y = s.y + 10; G.P.inv = 1e9; }, spot);
    await until([a, b], async () => (await a.eval(() => (window.__G.mons().find((x) => x.type === 'gchief' && !x.dead) || {}).bsN)) === 2);
    // B lands blows worth 10% of the boss, A (the host) 30%
    await b.eval(() => { const G = window.__G, m = G.mons().find((x) => x.type === 'gchief' && !x.dead); const k = Math.round(m.max * .1); for (let i = 0; i < 10; i++) window.__GM.hit(m, Math.round(k / 10)); m.hp -= k; m.myd = (m.myd || 0) + k; });
    await until([a, b], async () => (await rows(a)).length === 2);
    await a.eval(() => { const G = window.__G, m = G.mons().find((x) => x.type === 'gchief' && !x.dead); const k = Math.round(m.max * .3); m.hp -= k; m.myd = (m.myd || 0) + k; });
    await until([a, b], async () => { const r = await rows(b); return r.length === 2 && r.some((x) => !x.me && x.p >= 70); });
    const ra = await rows(a), rb = await rows(b);
    assert.deepEqual(ra.map((x) => [x.me, x.p, x.ok]), [[true, 75, true], [false, 25, true]], 'the host sees 30 against 10');
    assert.ok(rb.find((x) => x.me).p <= 27 && rb.find((x) => x.me).p >= 23, 'B sees its own quarter: ' + JSON.stringify(rb));
    await a.step(10);
    assert.match(await a.eval(() => document.getElementById('bdm').textContent), /Bassem/);
    const xp = await a.eval(() => { const G = window.__G, m = G.mons().find((x) => x.type === 'gchief' && !x.dead); const c = window.__GBDM.coop(m); window.__GPB7.kill(m); return { c, coop: m.coop, toasts: [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | ') }; });
    assert.equal(xp.c, 1); assert.equal(xp.coop, 1);
    await a.page.waitForTimeout(700); await a.step(5);
    assert.match(await a.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | ')), /Co-op bonus: \+10% XP/);
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
