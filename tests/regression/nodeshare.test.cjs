'use strict';
// v3.23 (plan U153) A vein one player mines is mined for everyone near: the last few taken ride in the presence fx with
// when they grow back on the world clock, so resources aren't doubled between two players at one vein. Only near the one who
// took it, and never longer than that kind grows back (review); the north's rows are below zero.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}

for (const mode of ['local', 'online']) {
  test(`[${mode}] a vein mined by one player is mined for the other`, async () => {
    const ctx = await H.newContext(mode === 'online' ? { scripts: [H.FAKE_FIREBASE] } : {});
    const a = await H.openGame({ ctx, query: `?net=${mode}&slot=a` });
    const b = await H.openGame({ ctx, query: `?net=${mode}&slot=b` });
    try {
      if (mode === 'online') for (const [g, n] of [[a, 'Ahmed'], [b, 'Bassem']]) {
        await g.eval((name) => { window.__fakeRTDB.nextName = name; document.getElementById('onlineBtn').click(); }, n);
        for (let i = 0; i < 100 && !(await g.eval(() => !!Satisfy.local.net())); i++) await g.page.waitForTimeout(50);
      }
      await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
      await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
      await b.eval(() => { window.__G.P.x += 20; });
      await settle(a, b);
      // (review) a vein far from where A stands: B doesn't take A's word for it
      const far = await a.eval(() => window.__GMN.find('mith'));
      assert.ok(far >= 0, 'a mithril vein');
      await a.eval((i) => window.__GMN.take(i), far);
      await settle(a, b); await settle(a, b);
      assert.equal(await b.eval((i) => window.__GMN.dep(i), far), 0, 'not where A is not');
      // both at a vein in the north (its row is below zero), and another vein: A takes them, B sees both taken
      const i = await a.eval(() => window.__GMN.north());
      assert.ok(i >= 0, 'a node in the north');
      const xy = await a.eval((i) => window.__GMN.at(i), i);
      for (const [g, dx] of [[a, 10], [b, 30]]) await g.eval(([x, y, dx]) => { const P = window.__G.P; P.x = x + dx; P.y = y + 8; }, [xy[0], xy[1], dx]);
      await settle(a, b); await settle(a, b);
      assert.equal(await b.eval((i) => window.__GMN.dep(i), i), 0, 'whole on both');
      const at = await a.eval((i) => window.__GMN.take(i), i);
      assert.ok(at[1] < 0);
      assert.match(await a.eval(() => window.__GMN.pub()), new RegExp('\\.?' + at[0].toString(36) + '_' + at[1].toString(36) + '_'));
      let d = 0;
      for (let k = 0; k < 20 && !(d > 0); k++) { await settle(a, b); d = await b.eval((i) => window.__GMN.dep(i), i); }
      assert.ok(d > 0 && d <= 42, "taken on B's screen too, no longer than it grows back: " + d);
      for (const g of [a, b]) assert.deepEqual(g.errors, []);
    } finally { await ctx.close(); }
  });
}
