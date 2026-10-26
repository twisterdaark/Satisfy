'use strict';
// Plan U070 (2026-10-26): the War Commander's Order reaches the party within 160 px (+15% damage, 10% less taken); party
// auras stacked from several players are capped (×1.6 damage, 30% less damage at most).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) { for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); } }
async function until(g, fn, ms = 6000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}

test('the stacked auras are capped on your own screen', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, P = G.P, U = window.__GU070, m = G.mons().find((x) => !x.dead && !x.tmp);
      const base = U.atk(m); P.ssFU = window.__GPB7.gt() + 30; P.bls = 30; P.jud = 30; G.S.cls = 'saint';
      const capped = U.atk(m); const hurt = U.hurt(1000, m);
      return { base, capped, hurt };
    });
    assert.equal(r.base, 1); assert.ok(Math.abs(r.capped - 1.6) < 1e-9, 'capped at ×1.6: ' + r.capped);
    assert.equal(r.hurt, 765, 'Blessing and Judar: 0.9 × 0.85, above the floor');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the Order reaches a party member near the commander', async () => {
  const ctx = await H.newContext({});
  const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
  const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
  try {
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    await a.page.keyboard.press('KeyP'); await settle(a, b);
    await until(b, () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY'); await settle(a, b);
    for (const g of [a, b]) await until(g, () => ((Satisfy.local.net().party || {}).members || []).length === 2);
    const before = await b.eval(() => window.__GU070.atk(window.__G.mons().find((x) => !x.dead && !x.tmp)));
    const st = await a.eval(() => { const G = window.__G, S = G.S, P = G.P; S.cls = 'warcmd'; S.lv = 130; G.isk.checkSkills(); P.cd = {}; P.mp = 1e6; window.__GSS2.cast('wcorder'); return window.__GU070.st(); });
    assert.match(st, /O/, 'the commander shows the Order');
    for (let i = 0; i < 40 && !(await b.eval(() => window.__GU070.atk(window.__G.mons().find((x) => !x.dead && !x.tmp)) > 1.1)); i++) await settle(a, b);
    const r = await b.eval(() => { const m = window.__G.mons().find((x) => !x.dead && !x.tmp); return { atk: window.__GU070.atk(m), hurt: window.__GU070.hurt(1000, m) }; });
    assert.equal(before, 1);
    assert.ok(Math.abs(r.atk - 1.15) < 1e-9, '+15% damage: ' + r.atk); assert.equal(r.hurt, 900, '10% less taken');
    await b.eval(() => { window.__G.P.x += 400; }); await settle(a, b);
    assert.equal(await b.eval(() => window.__GU070.atk(window.__G.mons().find((x) => !x.dead && !x.tmp))), 1, 'not past 160 px');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
