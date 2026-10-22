'use strict';
// SAT-ONLINE-110 (plan U220): merchant caravans. At a merchant you buy goods for another town's merchant; the farther, the
// dearer and the longer on the road. The safe road pays 30% on top and survives a fall; the risky road pays 80% but outlaws
// ambush you outside towns and a fall loses the load. Online the server stamps the start and takes the delivery only after
// its time on the road, within two hours, for the same route and goods (the reward's proof).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(games, fn, ms = 10000, arg) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn, arg))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const g of games) await g.step(5);
    await games[0].page.waitForTimeout(30);
  }
}
const keepToasts = (g) => g.eval(() => { window.__toastSeen = ''; const box = document.getElementById('toasts'); new MutationObserver(() => { window.__toastSeen += '|' + box.textContent; }).observe(box, { childList: true, subtree: true, characterData: true }); });
// move a page's clock on by ms from where it is (its Date.now, which the fake's rules use too)
const later = (g, ms) => g.eval((d) => { if (!window.__now0) { window.__now0 = Date.now; window.__dt = 0; } window.__dt += d; const b = window.__now0; Date.now = () => b() + window.__dt; }, ms);
// close whatever dialog is open (Escape does not; its last choice or the next line does)
async function shut(g) {
  for (let i = 0; i < 8 && (await g.mode()) === 'dialog'; i++) {
    await g.eval(() => { const b = [...document.querySelectorAll('#dopts button')]; if (b.length && !document.getElementById('dopts').hidden) b[b.length - 1].click(); else window.__G.advance(); });
    await g.step(2);
  }
}
const gold = (g) => g.eval(() => window.__G.S.gold);
const text = (g) => g.eval(() => document.getElementById('dtext').textContent);

test('caravans offline: priced by distance, paid on delivery after the road; the risky road pays more, ambushes and is lost in a fall', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await keepToasts(g);
    await g.eval(() => { window.__G.S.gold = 100000; window.__G.S.lv = 20; });
    const towns = await g.eval(() => window.__GCAR.towns());
    assert.equal(towns.zWin.m, 'merchant');
    assert.ok(Object.keys(towns).length >= 4, 'merchants in several towns: ' + Object.keys(towns));
    const near = await g.eval(() => window.__GCAR.route('zWin', 'zPat')), far = await g.eval(() => window.__GCAR.route('zWin', 'zReid'));
    assert.ok(far.g > near.g && far.md >= near.md, 'farther is dearer and longer');
    // the merchant offers it
    await g.eval(() => window.__G.talkNPC('merchant')); await g.step(2);
    for (let i = 0; i < 3 && await g.eval(() => document.getElementById('dopts').hidden); i++) { await g.eval(() => window.__G.advance()); await g.step(2); }
    assert.ok((await g.eval(() => [...document.querySelectorAll('#dopts button')].map((x) => x.textContent))).some((x) => /Merchant caravan/.test(x)));

    // the safe road: paid 30% more, only after its time on the road
    const g0 = await gold(g);
    await g.eval(() => window.__GCAR.start('merchant', 'zPat', 0)); await g.step(2);
    assert.equal(await gold(g), g0 - near.g);
    assert.equal(await g.eval(() => window.__GCAR.car.to), 'zPat');
    await g.eval(() => window.__GCAR.start('merchant', 'zReid', 0)); await g.step(2);
    assert.match(await g.eval(() => window.__toastSeen), /You are carrying goods already/);
    await g.eval(() => window.__GCAR.deliver('merchantP')); await g.step(2);
    assert.match(await text(g), /The goods need more time on the road/);
    assert.equal(await gold(g), g0 - near.g);
    await later(g, near.md + 1000);
    await g.eval(() => window.__GCAR.deliver('merchantP')); await g.step(2);
    assert.equal(await gold(g), g0 - near.g + Math.round(near.g * 1.3));
    assert.equal(await g.eval(() => window.__GCAR.car), null);
    // a safe load survives a fall
    await g.eval(() => window.__GCAR.start('merchant', 'zPat', 0));
    assert.ok(await g.eval(() => !!window.__GCAR.car));
    await shut(g);
    await g.eval(() => { window.__G.P.hp = 0; window.__G.die(); }); await g.step(5);
    assert.ok(await g.eval(() => !!window.__GCAR.car), 'kept');
    await g.eval(() => window.__GCAR.lose('carLost'));

    // the risky road: outlaws outside towns (they leave with the load), and a fall loses it
    await g.eval(() => window.__GK.respawn()); await g.step(30);
    await g.waitMode('play');
    await g.eval(() => window.__GCAR.start('merchant', 'zPat', 1));
    assert.ok(await g.eval(() => !!window.__GCAR.car), 'a risky load');
    await shut(g);
    assert.equal(await g.eval(() => window.__GCAR.pay(window.__GCAR.car)), Math.round(near.g * 1.8));
    await g.eval(() => { const P = window.__G.P; P.x = 90 * 16 + 8; P.y = 60 * 16 + 8; P.inv = 1e9; }); await g.step(2); // the plains, out of any town
    assert.equal(await g.eval(() => window.__GU.zoneAt(window.__G.P.x, window.__G.P.y)), 'zPlains');
    let amb = false;
    for (let i = 0; i < 60 && !amb; i++) { amb = await g.eval(() => { window.__GCAR.amb = 0; window.__GCAR.tick(0.01); return window.__G.mons().some((m) => m.car && !m.dead); }); }
    assert.ok(amb, 'an ambush on the risky road');
    assert.match(await g.eval(() => window.__toastSeen), /Outlaws ambush the caravan!/);
    await g.eval(() => { window.__G.P.inv = 0; window.__G.P.hp = 0; window.__G.die(); }); await g.step(5);
    assert.equal(await g.eval(() => window.__GCAR.car), null, 'the load lost in the fall');
    assert.match(await g.eval(() => window.__toastSeen), /The goods were lost/);
    await g.eval(() => window.__GCAR.tick(0.01));
    assert.equal(await g.eval(() => window.__G.mons().filter((m) => m.car && !m.dead).length), 0, 'the outlaws leave with it');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('caravans online: the server stamps the start and takes the delivery only after its road, for the same goods', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const g = await H.openGame({ ctx, query: '?net=online&slot=a' });
    await g.eval(() => { const D = window.__fakeRTDB.data; D.set('accountIds/gCvA1', 'Ahmed'); D.set('handles/ahmed', 'gCvA1'); window.__fakeRTDB.nextName = 'Ahmed'; window.__fakeRTDB.nextUid = 'gCvA1'; document.getElementById('onlineBtn').click(); });
    await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
    await H.newGame(g);
    await keepToasts(g);
    await g.eval(() => { window.__G.S.gold = 100000; });
    await settle(g);
    const R = await g.eval(() => window.__GCAR.route('zWin', 'zPat'));
    await g.eval(() => window.__GCAR.start('merchant', 'zPat', 0));
    await until([g], () => !!window.__fakeRTDB.data.get('caravans/gCvA1'));
    const c = await g.eval(() => window.__fakeRTDB.data.get('caravans/gCvA1'));
    assert.deepEqual([c.f, c.to, c.g, c.r, c.md, typeof c.t], ['zWin', 'zPat', R.g, 0, R.md, 'number']);
    const write = (u) => g.eval(async (x) => { const F = window.__GLD.fb(), D = F.m.database; for (const k in x) if (x[k] && x[k].t === 'SV') x[k].t = D.serverTimestamp(); try { await D.update(D.ref(F.db), x); return 'ok'; } catch (e) { return 'no'; } }, u);
    const done = (o) => ({ 'caravans/gCvA1': null, ['caravanDone/gCvA1/' + c.id]: Object.assign({ f: 'zWin', to: 'zPat', g: c.g, r: 0, t: 'SV' }, o) });
    // the rules: not before its road, not for other goods, one at a time
    assert.equal(await write(done({})), 'no', 'not before its time on the road');
    assert.equal(await write({ 'caravans/gCvA1': Object.assign({}, c, { t: 'SV' }) }), 'no', 'one at a time');
    await later(g, R.md + 1000);
    assert.equal(await write(done({ g: c.g * 10 })), 'no', 'not for more goods');
    assert.equal(await write(done({ to: 'zReid' })), 'no', 'not to another town');
    assert.equal(await write({ ['caravanDone/gCvA1/' + c.id]: { f: 'zWin', to: 'zPat', g: c.g, r: 0, t: 'SV' } }), 'no', 'not with the caravan still out');
    // the game delivers it: paid, the start gone, the delivery kept
    const g0 = await gold(g);
    await g.eval(() => window.__GCAR.deliver('merchantP'));
    await until([g], (x) => window.__G.S.gold === x, 10000, g0 + Math.round(c.g * 1.3));
    assert.ok(await g.eval((id) => !window.__fakeRTDB.data.has('caravans/gCvA1') && window.__fakeRTDB.data.has('caravanDone/gCvA1/' + id), c.id));
    // and a load two hours late spoils
    await g.eval(() => window.__GCAR.start('merchant', 'zPat', 0));
    await until([g], () => !!window.__fakeRTDB.data.get('caravans/gCvA1'));
    await later(g, 2 * 3600000 + 1000);
    await g.eval(() => window.__GCAR.tick(0.01));
    assert.equal(await g.eval(() => window.__GCAR.car), null);
    await until([g], () => /spoiled/.test(window.__toastSeen) && !window.__fakeRTDB.data.has('caravans/gCvA1'));
    assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected.filter((x) => !/caravan/.test(x))), []);
    assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
