'use strict';
// U304 Daily weather (SAT-ONLINE-177; plan: "coordinated climate display per region", check: "all players see same storm
// clock"):
//   - the forecast comes from the one weather clock: what is next and when, then after that; two pages read the same;
//   - the HUD clock shows the weather where you are (an icon, the forecast in its tip);
//   - a livelier sky: rain splashes where it lands (not with Reduced motion), a storm's sheet lightning, fog banks, snow;
//     and the sky draws without errors in every weather.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the forecast and the HUD clock: one clock for every page', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx }), b = await H.openGame({ ctx });
    await H.newGame(a); await H.newGame(b);
    await a.step(70); await b.step(70);
    const fa = await a.eval(() => window.__GWX.fore()), fb = await b.eval(() => window.__GWX.fore());
    assert.deepEqual(fa, fb, 'the same forecast on both pages');
    // it agrees with the slots: now, the first slot after with other weather, the one after that
    const want = await a.eval(() => { const X = window.__GWX, n = Date.now(), sl = Math.floor(n / X.WXS), now = X.at(sl); let j = sl + 1; while (X.at(j) === now) j++; const next = X.at(j); let k = j + 1; while (X.at(k) === next) k++; return { now, next, m: Math.ceil((j * X.WXS - n) / 60000), then: X.at(k) }; });
    assert.equal(fa.now, want.now);
    assert.equal(fa.next, want.next);
    assert.equal(fa.then, want.then);
    assert.ok(Math.abs(fa.m - want.m) <= 1, fa.m + ' min');
    assert.notEqual(fa.next, fa.now);
    const clk = await a.eval(() => window.__GWX.clk());
    const name = (w) => ({ clear: 'Clear', rain: 'Rain', storm: 'Storm', fog: 'Fog', snow: 'Snow' })[w];
    assert.match(clk.tip, new RegExp('in ' + fa.m + ' min: ' + name(fa.next) + ', then: ' + name(fa.then)));
    // forced rain: the clock shows it
    await a.eval(() => window.__GU.forceWeather('rain')); await a.step(70);
    assert.match((await a.eval(() => window.__GWX.clk())).l, /🌧$/);
    await a.close(); await b.close();
  } finally { await ctx.close(); }
});

test('a livelier sky: splashes, sheet lightning, fog banks, snow; Reduced motion keeps it still', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.eval(() => { window.__G.P.inv = 1e9; window.__GU.forceWeather('rain'); });
    await g.step(90);
    assert.ok(await g.eval(() => window.__GWX.sp) > 0, 'splashes');
    // a storm: the sky flickers now and then
    await g.eval(() => window.__GU.forceWeather('storm'));
    const s0 = await g.eval(() => window.__GWX.sheet);
    let sheet = s0;
    for (let i = 0; i < 40 && sheet === s0; i++) { await g.step(30); sheet = await g.eval(() => window.__GWX.sheet); }
    assert.ok(sheet > s0, 'sheet lightning');
    await g.eval(() => window.__GU.forceWeather('fog')); await g.step(10);
    assert.equal(await g.eval(() => window.__GWX.fb), 6, 'fog banks');
    await g.eval(() => window.__GU.forceWeather('snow')); await g.step(30);
    // Reduced motion: no splashes
    await g.eval(() => { window.__GRMO.set(true); window.__GU.forceWeather('rain'); });
    await g.step(60);
    assert.equal(await g.eval(() => window.__GWX.sp), 0, 'none with Reduced motion');
    await g.eval(() => { window.__GRMO.set(false); window.__GU.forceWeather(null); });
    await g.step(10);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
