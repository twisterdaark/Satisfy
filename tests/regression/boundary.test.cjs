'use strict';
// SAT-ONLINE-117 (plan U324): exception boundaries. With the other players' part of the scene broken on purpose (as a bad
// message or a bug there would), the world still draws every frame without it, the HUD keeps up, the error is told once,
// and the player is drawn again when it heals; a broken network tick or minimap stops only itself.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 6; i++) { for (const g of games) await g.step(4); await games[0].page.waitForTimeout(25); }
}
async function until(games, fn, ms = 8000, arg) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn, arg))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const g of games) await g.step(2);
    await games[0].page.waitForTimeout(20);
  }
}
const drawn = (g) => g.eval(() => window.__GFAULT.drawn), others = (g) => g.eval(() => window.__GFAULT.net);

test('a broken part of the frame costs only that part: the world, the HUD and the rest keep going', async () => {
  const ctx = await H.newContext({ scripts: [H.fixedClock()] });
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    await until([b], () => Satisfy.local.net().remotes.length === 1);
    await b.step(2);
    const n0 = await drawn(b);
    assert.ok(n0 > 100, 'the world is drawn: ' + n0);
    assert.equal(await others(b), 1, 'and the other player');

    // the other players' part breaks: everything else still draws, every frame
    await b.eval(() => window.__GFAULT.on('netEnts'));
    for (let i = 0; i < 5; i++) {
      await b.step(1);
      const n = await drawn(b);
      assert.ok(n > n0 - 20, `frame ${i}: the world without the other player (${n}, before ${n0})`);
      assert.equal(await others(b), 0, `frame ${i}: the other player is not`);
    }
    assert.ok((await b.eval(() => window.__GFAULT.errs)).includes('fault: netEnts'), 'told');
    const hp0 = await b.eval(() => document.getElementById('hpt').textContent);
    await b.eval(() => { window.__G.P.hp = Math.max(1, Math.round(window.__G.P.hp / 2)); });
    await b.step(20);
    assert.notEqual(await b.eval(() => document.getElementById('hpt').textContent), hp0, 'the HUD keeps up');
    await b.eval(() => window.__GFAULT.off('netEnts'));
    await b.step(2);
    assert.equal(await others(b), 1, 'healed: the other player is drawn again');

    // a broken network tick or minimap stops only itself
    for (const k of ['netTick', 'mini']) {
      await b.eval((x) => window.__GFAULT.on(x), k);
      for (let i = 0; i < 15; i++) await b.step(1);
      assert.ok(await drawn(b) > n0 - 20, k + ': the world still draws');
      assert.ok((await b.eval(() => window.__GFAULT.errs)).includes('fault: ' + k));
      await b.eval((x) => window.__GFAULT.off(x), k);
    }
    await settle(a, b);
    await until([a], () => Satisfy.local.net().remotes.length === 1, 8000);
    assert.equal(await b.eval(() => window.__G.mode), 'play');
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors.filter((e) => !/fault: /.test(e)), []);
  } finally { await ctx.close(); }
});
