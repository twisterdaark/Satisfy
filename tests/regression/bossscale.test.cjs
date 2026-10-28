'use strict';
// SAT-ONLINE-083 (plan U188) over the fake Firebase: a boss's health follows the group fighting it. A alone at the Goblin
// Chief: its old health. B comes within 600 px: the host's boss has 1.6 times the health, with the same share left, and
// B's copy shows the same share. A hits it, B leaves: back to one player's health, the share kept. The budget stops at ten.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const frames = async (gs, n) => { for (let k = 0; k < n; k++) { for (const g of gs) await g.step(2); await gs[0].page.waitForTimeout(12); } };
async function online(ctx, k, uid, name) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  for (let i = 0; i < 80 && !(await g.eval(() => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE')); i++) { await g.step(3); await g.page.waitForTimeout(30); }
  return g;
}
const boss = (g) => g.eval(() => { const m = window.__G.mons().find((x) => x.type === 'gchief' && !x.dead); return m ? { hp: m.hp, max: m.max, share: m.hp / m.max, n: m.bsN || 1 } : null; });
async function until(gs, fn, ms = 10000) {
  const end = Date.now() + ms;
  for (;;) { if (await fn()) return; if (Date.now() > end) throw new Error('timed out: ' + fn); await frames(gs, 5); }
}

test('a boss has the health of the group near it, the same share on every screen', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    assert.deepEqual(await (async () => { const g = await H.openGame({ ctx }); const r = await g.eval(() => [1, 2, 5, 10, 12].map((n) => Math.round(window.__GBSC.of(n) * 100) / 100)); await g.close(); return r; })(), [1, 1.6, 3.4, 6.4, 6.4], '+60% a player, up to ten');
    const a = await online(ctx, 'a', 'gBsA1', 'Ahmed');
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await online(ctx, 'b', 'gBsB2', 'Bassem'); // arrives second: A hosts
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    // no hero met fighting it: which boss one fights comes from the wall clock (8-minute slots) and the list of bosses, so on
    // some slots it was this one, chipping it (the share moved)
    for (const g of [a, b]) await g.eval(() => window.__GMEET.stop());
    // A at the chief (frozen, so it can't fight), B 450 px away: one group (520), but not near the boss (600 px)
    const spot = await a.eval(() => { const G = window.__G, m = G.mons().find((x) => x.type === 'gchief' && !x.dead); m.stun = 1e9; G.P.x = m.sx - 40; G.P.y = m.sy; G.P.inv = 1e9; return { x: m.sx, y: m.sy }; });
    await b.eval((s) => { const G = window.__G, m = G.mons().find((x) => x.type === 'gchief' && !x.dead); if (m) m.stun = 1e9; G.P.x = s.x - 40 - 650; G.P.y = s.y; G.P.inv = 1e9; }, spot);
    await frames([a, b], 60);
    const one = await boss(a);
    assert.equal(one.n, 1, 'one player near it');
    const base = one.max;
    // B comes close: 1.6 times the health, the same share; B's bar matches
    await b.eval((s) => { const G = window.__G; G.P.x = s.x - 60; G.P.y = s.y + 10; }, spot);
    await until([a, b], async () => (await boss(a)).n === 2);
    const two = await boss(a);
    assert.equal(two.max, Math.round(base * 1.6));
    assert.ok(Math.abs(two.share - one.share) < 0.002, 'the share left is kept');
    await until([a, b], async () => { const x = await boss(b); return x && Math.abs(x.share - two.share) < 0.01; });
    // A takes half of it; B leaves: one player's health again, still half left
    await a.eval(() => { const m = window.__G.mons().find((x) => x.type === 'gchief' && !x.dead); m.hp = Math.round(m.max / 2); });
    await b.eval((s) => { const G = window.__G; G.P.x = s.x - 40 - 650; G.P.y = s.y; }, spot);
    await until([a, b], async () => (await boss(a)).n === 1);
    const back = await boss(a);
    assert.equal(back.max, base);
    assert.ok(Math.abs(back.share - 0.5) < 0.002, 'half left: ' + back.share);
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
