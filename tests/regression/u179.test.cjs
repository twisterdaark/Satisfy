'use strict';
// Plan U179 (2026-10-26): the Storm Temple's rods are the whole temple's. A rod another player near the temple holds grounded
// counts for you too, so two players can share the four; it charges again when they leave, or when the Storm Lord falls.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) { for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); } }
const atk = (g) => g.eval(() => { const m = window.__G.mons().find((x) => x.type === 'slord' && !x.tmp); return window.__GP3.atk(m); });
const enter = (g, dx, rods) => g.eval(([dx, rods]) => { const G = window.__G, U = window.__GP3, P = G.P, T = U.STT;
  P.x = T.cx * 16 + 8 + dx; P.y = (T.gy + 6) * 16 + 8; P.inv = 1e9; for (const i of rods) U.P3.rod[i] = 1; return U.rodSt(); }, [dx, rods]);

test('two players share the four rods', async () => {
  const ctx = await H.newContext({});
  const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
  const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
  try {
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    assert.equal(await enter(a, 0, [0, 1]), 'IJ', 'A publishes its two rods');
    assert.equal(await enter(b, 30, [2, 3]), 'KY');
    let ok = false;
    for (let i = 0; i < 40 && !ok; i++) { await settle(a, b); ok = (await atk(a)) === 1 && (await atk(b)) === 1; }
    assert.equal(ok, true, 'both see the Lord unshielded');
    assert.deepEqual(await b.eval(() => [0, 1, 2, 3].map((i) => window.__GP3.rodOn(i))), [true, true, true, true]);
    // A walks away: its two rods charge again on B's screen (A's own stay grounded for 30 s)
    await a.eval(() => { window.__G.P.x -= 60 * 16; });
    let back = false;
    for (let i = 0; i < 40 && !back; i++) { await settle(a, b); back = (await atk(b)) === 0.1; }
    assert.equal(back, true, 'shielded again for B');
    assert.deepEqual(await b.eval(() => [0, 1, 2, 3].map((i) => window.__GP3.rodOn(i))), [false, false, true, true]);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('a fallen Storm Lord charges the rods again', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await enter(g, 0, [0, 1, 2, 3]); await g.step(3);
    assert.equal(await atk(g), 1);
    await g.eval(() => { window.__G.mons().find((x) => x.type === 'slord' && !x.tmp).dead = true; }); await g.step(3);
    assert.deepEqual(await g.eval(() => window.__GP3.P3.rod), [0, 0, 0, 0]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
