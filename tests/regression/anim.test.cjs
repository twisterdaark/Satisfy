'use strict';
// SAT-ONLINE-114 (plan U312): animations from one state machine per entity (src/core/anim.js). Your swing reaches the
// other player as 'attack' and ends 230 ms of game time after the last swinging frame; another player whose health
// drops flashes for 240 ms like a hit monster; a machine goes with the player it belongs to (nothing left behind).
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
// step every page, check one (the others publish meanwhile)
async function watch(games, g, fn, ms = 6000, arg) {
  const end = Date.now() + ms;
  for (;;) {
    if (await g.eval(fn, arg)) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const x of games) await x.step(1);
    await g.page.waitForTimeout(15);
  }
}
const seenAnim = (g) => g.eval(() => { const r = Satisfy.local.net().remotes[0]; return r ? r.anim : null; });

test('your swing as the others see it, their hurt flash, and no machine left behind', async () => {
  const ctx = await H.newContext({ scripts: [H.fixedClock()] });
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    await until([b], () => Satisfy.local.net().remotes.length === 1);
    assert.equal(await seenAnim(b), 'idle');

    // the swing: 'attack' while it lasts (0.14 s) and 230 ms of game time after
    const g0 = await a.eval(() => { window.__G.P.slash = { t: 0.14, a: 0 }; return window.__GANIM.t(); });
    assert.equal(await a.eval(() => window.__GANIM.anim()), 'attack');
    let bSaw = false;
    for (let i = 0; i < 60 && await a.eval(() => window.__GANIM.anim()) === 'attack'; i++) {
      await a.step(1); await b.step(1); await b.page.waitForTimeout(10);
      bSaw = bSaw || (await seenAnim(b)) === 'attack';
    }
    const held = (await a.eval((t) => window.__GANIM.t() - t, g0)) / 1000;
    assert.ok(held > 0.14 + 0.2 && held < 0.14 + 0.26, `attack held for ${held.toFixed(3)} s of game time`);
    assert.ok(bSaw, 'the other player saw the swing');
    await watch([a, b], b, () => Satisfy.local.net().remotes[0].anim === 'idle');

    // their health drops: hurt on this side, the flash on and off, then over
    const sid = await b.eval(() => Satisfy.local.net().remotes[0].sid);
    await a.eval(() => { const P = window.__G.P; P.hp = Math.max(1, Math.round(P.hp * 0.5)); });
    await watch([a, b], b, (s) => { const m = window.__GANIM.remote(s); return !!m && m.on('hurt', window.__GANIM.t()); }, 6000, sid);
    const flashes = await b.eval(async (s) => { const m = window.__GANIM.remote(s), seen = new Set(); for (let i = 0; i < 6; i++) { seen.add(m.blink(window.__GANIM.t())); window.__step(1); } return [...seen].sort(); }, sid);
    assert.deepEqual(flashes, [false, true], 'drawn flashing');
    await b.step(20);
    assert.equal(await b.eval((s) => window.__GANIM.remote(s).on('hurt', window.__GANIM.t()), sid), false, 'over after 240 ms');
    await b.step(20);
    assert.equal(await b.eval((s) => window.__GANIM.remote(s).state(window.__GANIM.t()), sid), 'idle', 'no second flash: health did not drop again');

    // a leaves: b keeps no machine for it
    assert.equal(await b.eval(() => window.__GANIM.n), 1);
    await a.close();
    await until([b], () => Satisfy.local.net().remotes.length === 0 && window.__GANIM.n === 0, 8000);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});
