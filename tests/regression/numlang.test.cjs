'use strict';
// Owner 2026-10-24: "the skill names that show are in your own language, not the caster's: someone playing in English
// could get the word in Arabic and the other way round". A word from the string table goes to other players as its key.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 6; i++) { for (const g of games) await g.step(4); await games[0].page.waitForTimeout(30); }
}

test("a skill's name over another player reads in your language, and a training dummy stays on its post", async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a', storage: { satisfy_lang: 'en' } });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b', storage: { satisfy_lang: 'ar' } });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x = window.__G.P.x + 40; });
    await settle(a, b);
    // B (Arabic) shows a skill's name: B reads it in Arabic, A (English) in English
    const ar = await b.eval(() => { window.__GHCM.numPK('sk_lpat'); return window.__GHCM.nums().slice(-1)[0]; });
    await settle(a, b); await settle(a, b);
    assert.match(ar, /[؀-ۿ]/, 'B sees Arabic: ' + ar);
    const seen = await a.eval(() => window.__GHCM.nums());
    assert.ok(seen.includes("Legendary Blacksmith's Patience"), 'A sees English: ' + JSON.stringify(seen));
    assert.ok(!seen.some((s) => /[؀-ۿ]/.test(s)), 'no Arabic on A');
    // the training dummies by Winston's armory: a knock moves one, the next frame it is back on its post
    await a.eval(() => { const P = window.__G.P; P.x = 221.75 * 16; P.y = 99 * 16; });
    await a.step(10);
    await a.eval(() => { const m = window.__G.mons().find((q) => q.tdum); m.x += 50; m.y -= 30; });
    await a.step(4);
    const d = await a.eval(() => window.__G.mons().filter((q) => q.tdum).map((m) => [m.x - m.sx, m.y - m.sy]));
    assert.equal(d.length, 3);
    assert.deepEqual(d, [[0, 0], [0, 0], [0, 0]]);
  } finally { await ctx.close(); }
});
