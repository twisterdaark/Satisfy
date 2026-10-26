'use strict';
// v3.24 (plan U365) Restoring the West together: every giant worm and nest put down in the Western Sands counts for the world;
// online each player's own count is world/satisfy/rw/{uid} (the rules: only up, 300 a write, every 20 s) and the total is
// their sum; the sands green from Reidan's wall as it grows, all of them at 3,000.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function until(games, fn, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const g of games) await g.step(5);
    await games[0].page.waitForTimeout(30);
  }
}

test('your own count: worms you put down before count, a worm in the sands adds one, elsewhere none, the West greens', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, S = G.S, W = window.__GRW; S.kills = S.kills || {}; S.kills.gworm = 7; S.kills.gwnest = 2; delete S.rw; const o = { seed: W.mine() };
      const w = G.spawnMon('gworm', 495 * 16, 76 * 16); W.kill(w); o.one = W.mine(); const far = G.spawnMon('gworm', 100 * 16, 100 * 16); W.kill(far); o.far = W.mine();
      o.f = W.frac(); S.rw = 1500; o.half = W.frac(); G.P.x = 505 * 16; G.P.y = 76 * 16; W.draw(); S.rw = 3000; o.full = W.frac(); return o; });
    assert.deepEqual([r.seed, r.one, r.far], [9, 10, 10], 'nine already, one more in the sands, none elsewhere');
    assert.ok(Math.abs(r.f - 10 / 3000) < 1e-6); assert.equal(r.half, 0.5); assert.equal(r.full, 1);
    await g.step(70);
    const ts = await g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | '));
    assert.match(ts, /The West lives again/); assert.equal(await g.eval(() => window.__G.S.rwSeen), 1);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('online: each count goes up 300 at a time, and the world sees the sum', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const pages = [];
    for (const [k, u, n] of [['a', 'rwA1', 'Ahmed'], ['b', 'rwB2', 'Bassem']]) {
      const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
      await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [u, n]);
      await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
      await H.newGame(g); pages.push(g);
    }
    const [a, b] = pages;
    await a.eval(() => { window.__G.S.rw = 500; }); await b.eval(() => { window.__G.S.rw = 40; });
    await until([a, b], () => { const R = window.__GRW.RWS; return !!R && !!R.rwA1 && !!R.rwB2; });
    assert.deepEqual(await a.eval(() => [window.__GRW.RWS.rwA1.n, window.__GRW.RWS.rwB2.n]), [300, 40], 'the first write: 300 of 500, and 40');
    assert.equal(await b.eval(() => window.__GRW.total()), 340, 'the world sees the sum');
    assert.equal(await a.eval(() => window.__GRW.total()), 540, 'and your own count as it is now');
    for (const g of pages) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
