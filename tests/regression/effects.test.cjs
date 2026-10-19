'use strict';
// SAT-ONLINE-030 (owner feedback #7): another player's swings, dashes and skills show on your screen (pictures only).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
const played = (g) => g.eval(() => Satisfy.local.net().fxPlayed);

test('a swing, a dash and a skill by A play on B\'s screen, once each, without touching B\'s game', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    // plains west of Winston, nothing else around
    for (const [g, dx] of [[a, 0], [b, 50]]) await g.eval((d) => { const G = window.__G; G.P.x = 90 * 16 + d; G.P.y = 60 * 16; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } }, dx);
    await settle(a, b);
    assert.deepEqual(await played(b), { s: 0, d: 0, k: 0 }, 'nothing replayed on first sight');
    const hpB = await b.eval(() => window.__G.P.hp);

    // a swing at empty ground
    const g0 = await a.eval(() => window.__G.toScreen(window.__G.P.x - 30, window.__G.P.y - 8));
    await a.page.mouse.click(g0.x, g0.y);
    await settle(a, b);
    assert.match(await a.eval(() => Satisfy.local.net().fx), /^\d+\|s\|-?\d+\|\d+$/);
    assert.equal((await played(b)).s, 1);
    // a dash
    await a.step(40);
    await a.page.keyboard.press('Space');
    await settle(a, b);
    assert.match(await a.eval(() => Satisfy.local.net().fx), /^\d+\|d\|-?\d+$/);
    assert.equal((await played(b)).d, 1);
    // a skill (slot 1: an any-class skill at Lv 5)
    await a.eval(() => { const G = window.__G; G.S.lv = 5; G.P.mp = 99; G.P.acd = 0; });
    await a.step(60);
    await a.page.keyboard.press('Digit1');
    await settle(a, b);
    const fx = await a.eval(() => Satisfy.local.net().fx);
    assert.match(fx, /^\d+\|k\|[a-z][A-Za-z0-9]*\|\[/, fx);
    assert.ok(JSON.parse(fx.split('|').slice(3).join('|')).length >= 1, 'it carries the effects it drew');
    assert.equal((await played(b)).k, 1);
    // nothing more is replayed while A does nothing, and B's own game is untouched
    await settle(a, b); await settle(a, b);
    assert.deepEqual(await played(b), { s: 1, d: 1, k: 1 });
    assert.equal(await b.eval(() => window.__G.P.hp), hpB);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
