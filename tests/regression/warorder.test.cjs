'use strict';
// v3.24 (plan U070) The War Commander's Order and Hold the Line reach the party within 10 m (status 'O' and 'N' in the
// presence); party buffs stack to twice the damage at most and to 40% of the damage taken at least; Guard Link isn't given
// by a fallen knight.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(games, fn, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { let ok = true; for (const g of games) if (!(await g.eval(fn))) ok = false; if (ok) return; for (const g of games) await g.step(3); await games[0].page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}

test("the commander's Order and Hold the Line on a party mate, and the caps", async () => {
  const ctx = await H.newContext();
  const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
  const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
  try {
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    await a.page.keyboard.press('KeyP'); await settle(a, b);
    await until([b], () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY'); await settle(a, b);
    await until([a, b], () => ((Satisfy.local.net().party || {}).members || []).length === 2);
    const base = await b.eval(() => [window.__GPWC.atk(), window.__GPWC.hurt(1000)]);
    await a.eval(() => { const G = window.__G, S = G.S; S.cls = 'warcmd'; S.lv = 160; S.sk = {}; G.isk.checkSkills(); G.P.mp = 1e6; window.__GSS2.cast('wcorder'); });
    await settle(a, b);
    await until([b], () => window.__GPWC.near('O', 160));
    const ord = await b.eval(() => [window.__GPWC.atk(), window.__GPWC.hurt(1000)]);
    assert.ok(Math.abs(ord[0] / base[0] - 1.25) < 1e-9, 'Order: +25% damage for the mate');
    assert.ok(ord[1] < base[1] * 0.9, 'and less taken: ' + ord[1]);
    await a.eval(() => { const P = window.__G.P; P.mp = 1e6; P.cd = {}; window.__GSS2.cast('wchold'); });
    await settle(a, b);
    await until([b], () => window.__GPWC.near('N', 160));
    const both = await b.eval(() => window.__GPWC.hurt(1000));
    assert.ok(both < ord[1], 'Hold the Line on top: ' + both);
    // the caps: every damage aura at once is at most twice; every guard at once leaves at least 40%
    const cap = await b.eval(() => { const P = window.__G.P, G = window.__G; P.ssFU = 1e12; P.bls = 99; P.jud = 99; P.dom = 99; P.gaL = 0; G.S.cls = 'saint'; return [window.__GPWC.atk(), window.__GPWC.hurt(1000)]; });
    assert.equal(cap[0], 2, 'stacked damage capped at twice');
    assert.ok(cap[1] >= 400, 'stacked guards leave at least 40%: ' + cap[1]);
    // out of reach: gone
    await b.eval(() => { const P = window.__G.P; P.x += 400; P.ssFU = 0; P.bls = 0; P.jud = 0; P.dom = 0; window.__G.S.cls = 'warrior'; });
    await settle(a, b);
    assert.equal(await b.eval(() => window.__GPWC.near('O', 160)), false, 'only within 10 m');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
