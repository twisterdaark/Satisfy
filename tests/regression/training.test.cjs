'use strict';
// U299 Training arena (SAT-ONLINE-169; plan: "practice dummy no real loot", check: "no XP farm by automation").
//   - three dummies stand by Winston's armory when you come near, and go when you leave; this screen's own (not shared);
//   - they never move, strike or fall; hitting one runs a meter (time, damage, DPS, hits, crits) that stops 4 s after the
//     last hit; a run of 10 s or more sets your best, a shorter one doesn't;
//   - nothing from them: no XP, gold, items, kill, weapon mastery, wear or one-hit record.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the training dummies: a DPS meter, a best of 10 s runs, and nothing else from them', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const far = await g.eval(() => window.__G.mons().filter((m) => m.tdum).length);
    assert.equal(far, 0, 'not there before you come near');
    // walk up to them
    await g.eval(() => { const G = window.__G, P = G.P, T = window.__GTD, [tx, ty] = T.TDSPOT[1]; P.x = tx * 16; P.y = (ty + 2.2) * 16; P.inv = 0; });
    await g.step(180); // the region's discovery and its exploring XP come first
    const near = await g.eval(() => { const G = window.__G, T = window.__GTD, D = G.mons().filter((m) => m.tdum); return { n: D.length, solid: D.map((m) => T.solid(m.x / 16 | 0, m.y / 16 | 0)), names: D.map((m) => m.nm), shared: D.map((m) => T.shared(m)) }; });
    assert.equal(near.n, 3, 'three dummies');
    assert.deepEqual(near.names, ['Training Dummy', 'Training Dummy', 'Training Dummy']);
    assert.deepEqual(near.solid, [false, false, false], 'on open ground');
    assert.deepEqual(near.shared, [false, false, false], 'not shared online');
    const before = await g.eval(() => { const S = window.__G.S, P = window.__G.P; return { xp: S.xp, lv: S.lv, gold: S.gold, items: S.items.length, kills: JSON.stringify(S.kills), mast: JSON.stringify(S.mast || {}), rec: S.hitRec || 0, hp: P.hp, dur: (window.__G.weapon && window.__G.weapon() || {}).dur }; });

    // 12 s of hits, one a second
    for (let i = 0; i < 12; i++) {
      await g.eval(() => { const G = window.__G, m = G.mons().find((x) => x.tdum && x.sx === window.__GTD.TDSPOT[1][0] * 16); window.__GWP.hit(m, 1); });
      await g.step(60);
    }
    const run = await g.eval(() => { const T = window.__GTD, M = T.M, m = window.__G.mons().find((x) => x.tdum); return { hits: M && M.hits, dmg: M && M.dmg, dps: T.dps(), dur: T.dur(), ui: T.ui(), full: m.hp === m.max, x: m.x, sx: m.sx }; });
    assert.equal(run.hits, 12);
    assert.ok(run.dmg > 0 && run.dps > 0, JSON.stringify(run));
    assert.ok(Math.abs(run.dps - Math.round(run.dmg / run.dur)) <= 1);
    assert.match(run.ui, /Training Dummy · \d+\.\d s · Damage [\d,]+ · DPS [\d,]+ · 12 hits/);
    assert.ok(run.full, 'never falls');
    assert.equal(run.x, run.sx, 'never moves');
    // it stops 4 s after the last hit: 11 s or more is a best
    await g.step(60 * 5);
    const end = await g.eval(() => ({ M: window.__GTD.M, best: window.__G.S.dpsB, hidden: document.getElementById('tdW').hidden }));
    assert.equal(end.M, null);
    assert.equal(end.best, run.dps, 'the best');
    assert.equal(end.hidden, true);
    // nothing from them
    const after = await g.eval(() => { const S = window.__G.S, P = window.__G.P; return { xp: S.xp, lv: S.lv, gold: S.gold, items: S.items.length, kills: JSON.stringify(S.kills), mast: JSON.stringify(S.mast || {}), rec: S.hitRec || 0, hp: P.hp, dur: (window.__G.weapon && window.__G.weapon() || {}).dur }; });
    assert.deepEqual(after, before, 'no XP, gold, items, kills, mastery, record, wear or damage taken');

    // a 3 s run doesn't count
    for (let i = 0; i < 3; i++) { await g.eval(() => { const m = window.__G.mons().find((x) => x.tdum); window.__GWP.hit(m, 50); }); await g.step(60); }
    await g.step(60 * 5);
    assert.equal(await g.eval(() => window.__G.S.dpsB), run.dps, 'a short run, however strong, is no best');

    // leaving: they go
    await g.eval(() => { const P = window.__G.P; P.x -= 60 * 16; });
    await g.step(5);
    assert.equal(await g.eval(() => window.__G.mons().filter((m) => m.tdum).length), 0);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
