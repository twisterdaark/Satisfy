'use strict';
// v3.24 (plan U179) The Storm Temple's four rods are one set for everyone in it: a rod one player grounds is grounded for the
// others there too (it rides in their presence with the Storm Lord's respawn time), so four players can ground one each.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}

test('a rod one player grounds is grounded for the other in the temple', async () => {
  const ctx = await H.newContext();
  const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
  const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
  try {
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    for (const [g, dx] of [[a, 0], [b, 24]]) await g.eval((dx) => { const G = window.__G, X = window.__GP3; G.S.lv = 300; G.P.hp = 1e9; G.P.x = X.STT.cx * 16 + dx; G.P.y = X.STT.gy * 16; for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } X.P3.rod = [0, 0, 0, 0]; }, dx);
    await settle(a, b);
    assert.equal(await b.eval(() => window.__GP3.storm()), true, 'B is in the temple');
    await a.eval(() => { window.__GP3.P3.rod[1] = 1; window.__GP3.P3.rod[2] = 1; });
    let got = null;
    for (let k = 0; k < 15 && !(got && got[1] && got[2]); k++) { await settle(a, b); got = await b.eval(() => window.__GP3.P3.rod.slice()); }
    assert.deepEqual(got, [0, 1, 1, 0], "A's two rods are grounded on B's screen");
    const ts = await b.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | '));
    assert.match(ts, /Grid grounded a lightning rod \(2\/4\)/);
    // B grounds the other two: all four, on both
    await b.eval(() => { window.__GP3.P3.rod[0] = 1; window.__GP3.P3.rod[3] = 1; });
    for (let k = 0; k < 15 && !(await a.eval(() => window.__GP3.grounded())); k++) await settle(a, b);
    assert.equal(await a.eval(() => window.__GP3.grounded()), true, 'the Storm Lord is open to everyone');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
