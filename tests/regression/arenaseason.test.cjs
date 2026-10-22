'use strict';
// SAT-ONLINE-129 (plan U344, "season rewards: non-competitive cosmetics first") over the fake Firebase. On 5 January the
// December arena season is over: Ahmed, first with 12 duels, gets Arena Champion and Arena Regular (cosmetic titles), told
// once; the season is looked at once. The same board gives the others what the rules of the season say: 5 duels for a
// place in the top ten, 10 for Regular, and 3 duels with a high rating give nothing.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

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
// December 2025's board: Ahmed first (12 duels), Bassem second (6), Carim's high rating from 3 duels only, ten others with
// 5 or more, and Dina low down with 11
const BOARD = { gArA1: [1500, 10, 2], gArB2: [1400, 4, 2], gArC3: [1450, 2, 1], gArD4: [900, 3, 8] };
for (let i = 0; i < 10; i++) BOARD['gArF' + i] = [1100 + i * 20, 3, 3];
// Claude-B's note on #165: a past season's board can still be written; an entry written after the season ended (its t, the
// server's time) doesn't count, so nobody takes first place on 2 January

test('arena season rewards: cosmetic titles for the finished season, given once; the season rules for everyone', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const g = await H.openGame({ ctx, query: '?net=online&slot=a' });
    await g.eval((B) => {
      const D = window.__fakeRTDB.data;
      for (const u in B) D.set('arena/s202512/' + u, { r: B[u][0], w: B[u][1], l: B[u][2], n: u.slice(3), t: 1 });
      D.set('arena/s202512/gArLate', { r: 3900, w: 30, l: 0, n: 'Late', t: Date.UTC(2026, 0, 2) });
      D.set('accountIds/gArA1', 'Ahmed'); window.__fakeRTDB.nextName = 'Ahmed'; window.__fakeRTDB.nextUid = 'gArA1';
      window.__toastNew = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) window.__toastNew.push(n.textContent); }).observe(document.getElementById('toasts'), { childList: true });
      document.getElementById('onlineBtn').click();
    }, BOARD);
    await until([g], () => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE', 15000);
    assert.equal(await g.eval(() => window.__GARN.prev(Date.now())), 's202512');
    assert.equal(await g.eval(() => window.__GARN.prev(Date.UTC(2026, 4, 1))), 's202604');
    await H.newGame(g);
    await until([g], () => !!(window.__GARN.got && 's202512' in window.__GARN.got), 15000);
    assert.deepEqual(await g.eval(() => window.__GARN.got), { s202512: 'arnReg,arnChamp' });
    assert.deepEqual(await g.eval(() => [window.__G.S.tl.arnReg, window.__G.S.tl.arnChamp, window.__G.S.tl.arnTop]), [1, 1, undefined]);
    await until([g], () => window.__toastNew.some((x) => /Arena season 2025-12 is over: Arena Regular, Arena Champion/.test(x)));
    // shown and worn from the status screen (C), like every title (Claude-B, v1.51: the list there missed them)
    assert.deepEqual(await g.eval(() => { window.__GU.openStatus(); return ['arnReg', 'arnChamp'].map((k) => !!document.querySelector('#statusW [data-title="' + k + '"]')); }), [true, true], 'on the C screen');
    await g.page.keyboard.press('Escape'); await g.step(2);
    // the season is looked at once
    await g.eval(() => window.__GARN.tick());
    for (let i = 0; i < 6; i++) { await g.step(10); await g.page.waitForTimeout(30); }
    assert.equal((await g.eval(() => window.__toastNew)).filter((x) => /Arena season 2025-12 is over/.test(x)).length, 1, 'told once');

    // the same board for the others: Bassem top ten; Carim nothing (3 duels); Dina Regular only (11 duels, 13th of those with 5)
    const top = Object.entries(BOARD).map(([uid, [r, w, l]]) => ({ uid, r, w, l })).sort((a, b) => b.r - a.r);
    const of = (uid) => g.eval(([T, me, u]) => window.__GARN.of(T, me, u), [top, top.find((x) => x.uid === uid), uid]);
    assert.deepEqual(await of('gArB2'), ['arnTop']);
    assert.deepEqual(await of('gArC3'), []);
    assert.deepEqual(await of('gArD4'), ['arnReg']);
    assert.deepEqual(await of('gArF9'), ['arnTop']);
    assert.deepEqual(await g.eval(() => window.__GARN.of([], null, 'x')), [], 'no board, nothing');
    const late = { uid: 'gArLate', r: 3900, w: 30, l: 0, t: Date.UTC(2026, 0, 2) };
    assert.deepEqual(await g.eval(([L, T]) => window.__GARN.of([L].concat(T), L, 'gArLate', Date.UTC(2026, 0, 1)), [late, top]), [], 'written after the season: nothing');
    assert.deepEqual(await g.eval(([L, T]) => window.__GARN.of([L].concat(T), T[0], T[0].uid, Date.UTC(2026, 0, 1)), [late, top]), ['arnReg', 'arnChamp'], 'and the first is still the first');

    assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
