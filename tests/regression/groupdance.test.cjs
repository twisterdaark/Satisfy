'use strict';
// v3.24 (plan U293) A group dance on Patrian's stage: a dance starts on the world clock's next 6 s beat with that beat's arrows,
// so two players who step on for the same beat dance the same sequence, see each other's steps, and score as a troupe; a
// good troupe is told so (no title: the owner keeps titles few), not paid.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 6; i++) { for (const g of games) await g.step(6); await games[0].page.waitForTimeout(30); }
}
const KEY = { L: 'ArrowLeft', U: 'ArrowUp', R: 'ArrowRight', D: 'ArrowDown' };

test('two dancers on one beat: the same arrows, each other in the count, and the troupe\'s score', async () => {
  const ctx = await H.newContext();
  const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
  const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
  try {
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    for (const g of [a, b]) await g.eval(() => { const G = window.__G; G.P.x = 381 * 16; G.P.y = 77 * 16 + 8; G.P.inv = 1e9; G.P.hp = 1e9; G.mons().forEach((m) => { m.dead = true; m.rt = 1e9; }); });
    await settle(a, b);
    // both step on within the same beat (at least 2 s before it, so the same one)
    await a.eval(() => { const now = Date.now(), off = 6000 - (now % 6000); if (off < 3000) { const t0 = Date.now(); while (Date.now() - t0 < off + 100); } });
    for (const g of [a, b]) await g.eval(() => window.__GP4.act({ k: 'p4stage' }));
    const [sa, sb] = [await a.eval(() => [window.__GP4.P4.dance.sl, window.__GP4.P4.dance.seq.join('')]), await b.eval(() => [window.__GP4.P4.dance.sl, window.__GP4.P4.dance.seq.join('')])];
    assert.deepEqual(sa, sb, 'the same beat, the same arrows');
    for (const g of [a, b]) await g.eval(() => { window.__GP4.P4.dance.wait = 0; });
    for (let i = 0; i < 10; i++) {
      for (const g of [a, b]) await g.eval(() => { const D = window.__GP4.P4.dance; D.t = 9; D.gap = 0; });
      for (const g of [a, b]) { const d = await g.eval(() => window.__GP4.P4.dance.seq[window.__GP4.P4.dance.i]); await g.page.keyboard.press(KEY[d]); await g.eval(() => { const D = window.__GP4.P4.dance; if (D && !D.end) D.t = 9; }); }
      await settle(a, b);
      if (i === 4) assert.equal(await a.eval(() => window.__GP4.mates().length), 1, 'B in the count on A\'s screen');
    }
    await a.page.waitForTimeout(1500); await settle(a, b);
    for (const g of [a, b]) {
      assert.equal(await g.eval(() => !!(window.__G.S.tl && window.__G.S.tl.troupe)), false, 'no title');
      const ts = await g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | '));
      assert.match(ts, /A group dance: 2 dancers, 20 of 20 steps right together\. A fine troupe!/);
    }
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
