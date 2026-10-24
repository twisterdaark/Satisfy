'use strict';
// U220 Region merchant caravans (SAT-ONLINE-192; plan: "market inter-region logistics and opt-in risks", check: "route
// reward requires server proof"):
//   - an innkeeper offers cargo for the three nearest towns on your continent; you pay for it and carry it;
//   - its town's innkeeper pays more, but not before the road's time has passed (a teleport is no trip);
//   - the risky road pays more and bandits come for it outside the towns; dying loses it; too long and it spoils;
//   - online the contract and the delivery go through the server, which refuses a delivery before the road's time.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const INNS = ['inn', 'innB', 'innP', 'innR', 'innRh', 'innT', 'innBu'];
const close = async (g) => { for (let n = 0; n < 30 && (await g.mode()) !== 'play'; n++) { await g.eval(() => window.__G.advance()); await g.step(1); } };
const innOf = (g, z) => g.eval(([ids, z]) => ids.find((id) => window.__GTTL.town(id) === z) || null, [INNS, z]);

test('caravans offline: pay, carry, too fast is refused, the road paid; bandits, death and spoiling', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const win = await innOf(g, 'zWin');
    assert.ok(win, 'Winston has an innkeeper');
    const routes = await g.eval(() => window.__GCV.routes('zWin'));
    assert.equal(routes.length, 3);
    assert.ok(routes.every((R) => R.to !== 'zWin' && R.c > 0 && R.p > R.c && R.r > R.p && R.min >= 20000), JSON.stringify(routes));
    const R = routes[0], to = await innOf(g, R.to);
    assert.ok(to, 'an innkeeper at ' + R.to);
    // the innkeeper's option, then the safe road
    const o = await g.eval((w) => window.__GCV.opts(w).map((x) => x.l), win);
    assert.match(o[0], /Caravan cargo/);
    const a = await g.eval(([w, R]) => { const S = window.__G.S; S.gold = 100000; window.__GCV.take(w, 'zWin', R, 0); return { gold: S.gold, car: S.car && [S.car.to, S.car.pay, S.car.risk] }; }, [win, R]);
    assert.deepEqual(a, { gold: 100000 - R.c, car: [R.to, R.p, 0] });
    // one at a time
    await g.eval(([w, R]) => window.__GCV.take(w, 'zWin', R, 1), [win, R]);
    assert.equal(await g.eval(() => window.__G.S.gold), 100000 - R.c);
    // at once at the other end: refused
    await g.eval((w) => window.__GCV.deliver(w), to);
    assert.deepEqual(await g.eval(() => [window.__G.S.gold, !!window.__G.S.car]), [100000 - R.c, true]);
    assert.match(await g.eval(() => String(window.__G.DL.lines[0])), /papers say you just left/);
    await close(g);
    // after the road's time: paid
    await g.eval((ms) => { const real = Date.now; Date.now = () => real() + ms; }, R.min + 1000);
    await g.eval((w) => window.__GCV.deliver(w), to);
    assert.deepEqual(await g.eval(() => [window.__G.S.gold, window.__G.S.car, window.__G.S.cvN]), [100000 - R.c + R.p, null, 1]);
    await close(g);
    // the risky road, out in the field: bandits come
    const b = await g.eval(([w, R]) => { const G = window.__G, P = G.P; window.__GCV.take(w, 'zWin', R, 1); P.x = 150 * 16 + 8; P.y = 50 * 16 + 8; const n0 = G.mons().filter((m) => m.tmp && !m.dead).length;
      for (let i = 0; i < 40 && G.mons().filter((m) => m.tmp && !m.dead).length === n0; i++) window.__GCV.tick(60);
      return { n: G.mons().filter((m) => m.tmp && !m.dead).length - n0, eng: G.mons().filter((m) => m.tmp && !m.dead).every((m) => m.eng > 0) }; }, [win, R]);
    assert.ok(b.n >= 2 && b.eng, 'bandits: ' + JSON.stringify(b));
    // spoiled when carried too long
    await g.eval(() => { const C = window.__G.S.car; C.t0 -= window.__GCV.max(C) + 1000; window.__GCV.tick(0.1); });
    assert.equal(await g.eval(() => window.__G.S.car), null, 'spoiled');
    // and lost when you fall
    await g.eval(([w, R]) => { const G = window.__G, P = G.P; G.S.gold = 100000; window.__GCV.take(w, 'zWin', R, 0); P.inv = 0; P.hp = 0; G.die(); }, [win, R]);
    for (let i = 0; i < 20 && (await g.eval(() => !!window.__G.S.car)); i++) await g.step(3);
    assert.equal(await g.eval(() => window.__G.S.car), null, 'lost with you');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

async function until(g, fn, ms = 15000, arg) {
  const end = Date.now() + ms;
  for (;;) { if (await g.eval(fn, arg)) return; if (Date.now() > end) throw new Error('timed out waiting for ' + fn); await g.step(5); await g.page.waitForTimeout(30); }
}

test('caravans online: the server takes the contract, and a delivery only after the road', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const g = await H.openGame({ ctx, query: '?net=online&slot=a' });
    await g.eval(() => { window.__fakeRTDB.data.set('accountIds/gCvA1', 'Ann'); window.__fakeRTDB.nextName = 'Ann'; window.__fakeRTDB.nextUid = 'gCvA1'; document.getElementById('onlineBtn').click(); });
    await until(g, () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE');
    await H.newGame(g);
    const win = await innOf(g, 'zWin'), R = (await g.eval(() => window.__GCV.routes('zWin')))[0], to = await innOf(g, R.to);
    await g.eval(([w, R]) => { window.__G.S.gold = 50000; window.__GCV.take(w, 'zWin', R, 0); }, [win, R]);
    await until(g, () => !!window.__G.S.car);
    const c = await g.eval(() => window.__fakeRTDB.data.get('caravans/gCvA1'));
    assert.deepEqual([c.f, c.to, c.min, typeof c.t], ['zWin', R.to, R.min, 'number']);
    // a delivery written straight to the server before the road's time: refused
    const forged = await g.eval(async (n) => { const F = window.__GLD.fb(), D = F.m.database; try { await D.set(D.ref(F.db, 'caravanDone/gCvA1/' + n), { t: D.serverTimestamp() }); return 'ok'; } catch (e) { return 'no'; } }, c.n);
    assert.equal(forged, 'no');
    // after it: the delivery goes through and pays
    await g.eval((ms) => { const real = Date.now; Date.now = () => real() + ms; }, R.min + 1000);
    await g.eval((w) => window.__GCV.deliver(w), to);
    await until(g, () => window.__G.S.car === null);
    assert.equal(await g.eval(() => window.__G.S.gold), 50000 - R.c + R.p);
    assert.ok(await g.eval((n) => !!window.__fakeRTDB.data.get('caravanDone/gCvA1/' + n), c.n));
    assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
