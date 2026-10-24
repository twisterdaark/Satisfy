'use strict';
// U307 Seasonal town decorations (SAT-ONLINE-179; plan: "asset pack lazy load behind event"):
//   - the dates: Harvest Night 20 Oct to 3 Nov, Winter Lights 15 Dec to 2 Jan (across the new year), nothing otherwise;
//   - out of season no pack is fetched; in season its own file loads, and the towns get its decorations (entities in the
//     scene), drawn without errors, by night and by day;
//   - the world notice says it has come, once a season on a device (not again after a reload);
//   - the game itself doesn't change: same state with and without (nothing solid: you walk where you walked).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const packs = (g) => g.eval(() => [...document.scripts].map((s) => s.src).filter((s) => /season-/.test(s)).map((s) => s.replace(/^.*\/(season-[a-z]+)\.js.*$/, '$1')));

test('the dates, and out of season nothing is fetched', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.step(30);
    const d = await g.eval(() => { const D = window.__GDEC, at = (m, day) => D.now(Date.UTC(2026, m - 1, day, 12)); return { o19: at(10, 19), o20: at(10, 20), o31: at(10, 31), n3: at(11, 3), n4: at(11, 4), d14: at(12, 14), d15: at(12, 15), d31: at(12, 31), j2: at(1, 2), j3: at(1, 3), jul: at(7, 1) }; });
    assert.deepEqual(d, { o19: null, o20: 'hallow', o31: 'hallow', n3: 'hallow', n4: null, d14: null, d15: 'winter', d31: 'winter', j2: 'winter', j3: null, jul: null });
    // the tests' clock is 5 January: no pack
    assert.deepEqual(await packs(g), []);
    assert.equal(await g.eval(() => window.__GDEC.pack), null);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

for (const [id, at, word] of [['hallow', Date.UTC(2026, 9, 31, 12), /Harvest Night has come/], ['winter', Date.UTC(2026, 11, 24, 12), /Winter Lights are up/]]) {
  test(id + ': its pack loads, the towns are decorated by day and night, the notice once', async () => {
    const ctx = await H.newContext({ scripts: [H.fixedClock(at)] });
    try {
      let g = await H.openGame({ ctx });
      await H.newGame(g);
      await g.eval(() => { window.__annSeen = []; const W = document.getElementById('announce'); new MutationObserver(() => { const s = document.getElementById('anntext').textContent; if (window.__annSeen[window.__annSeen.length - 1] !== s) window.__annSeen.push(s); }).observe(W, { childList: true, subtree: true, characterData: true, attributes: true }); });
      for (let i = 0; i < 20 && !(await g.eval(() => window.__GDEC.pack)); i++) { await g.step(30); await g.page.waitForTimeout(50); }
      assert.equal(await g.eval(() => window.__GDEC.pack), id);
      assert.deepEqual(await packs(g), ['season-' + id], 'only its own file');
      await g.step(10);
      assert.ok(await g.eval(() => window.__GDEC.n) > 0, 'decorations in view in Winston');
      // by night too (the lights, the bats)
      await g.eval(() => window.__GVP.force(22)); await g.step(60);
      assert.ok(await g.eval(() => window.__GDEC.n) > 0);
      await g.eval(() => window.__GVP.force(null));
      for (let i = 0; i < 10 && !(await g.eval((re) => window.__annSeen.some((s) => new RegExp(re).test(s)), word.source)); i++) { await g.step(30); await g.page.waitForTimeout(60); }
      assert.ok(await g.eval((re) => window.__annSeen.some((s) => new RegExp(re).test(s)), word.source), 'the notice');
      assert.deepEqual(g.errors, []);
      await g.close();
      // after a reload: decorated again, no notice again
      g = await H.openGame({ ctx });
      await H.continueGame(g);
      await g.eval(() => { window.__annSeen = []; const W = document.getElementById('announce'); new MutationObserver(() => { const s = document.getElementById('anntext').textContent; window.__annSeen.push(s); }).observe(W, { childList: true, subtree: true, characterData: true, attributes: true }); });
      for (let i = 0; i < 20 && !(await g.eval(() => window.__GDEC.pack)); i++) { await g.step(30); await g.page.waitForTimeout(50); }
      await g.step(150); await g.page.waitForTimeout(100); await g.step(30);
      assert.equal(await g.eval(() => window.__GDEC.pack), id);
      assert.ok(!(await g.eval((re) => window.__annSeen.some((s) => new RegExp(re).test(s)), word.source)), 'not twice');
      assert.deepEqual(g.errors, []);
      await g.close();
    } finally { await ctx.close(); }
  });
}
