'use strict';
// SAT-ONLINE-130 (plan U345, "retention without grind: no progress lost for missing a day"). The daily bounties' bonus is
// +10% for each day you cleared all three in the last 7 days (up to +50%); a missed day doesn't take anything away, as the
// old streak did (it went back to 0). An old save's streak becomes the days it stood for.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const DAY = 864e5, T0 = Date.UTC(2026, 0, 5, 9, 40); // the harness's fixed day
const goTo = (g, t) => g.eval((x) => { if (!window.__now0) window.__now0 = Date.now; const b = window.__now0; window.__dt = x - b(); Date.now = () => b() + window.__dt; }, t);
// clear today's three bounties the way a player does: the counts full, then turned in at the board
async function clearAll(g) {
  return g.eval(() => {
    const U = window.__GU, D = U.dlyS();
    for (const x of U.dailyList()) D.c[x.k] = x.n;
    for (let i = 0; i < 3; i++) { const o = U.dailyOpts(); if (o.length) o[0].f(); }
    return { all: D.all, streak: D.streak };
  });
}
const streak = (g) => g.eval(() => window.__GU.dlyS().streak);

test('daily bounties: a missed day loses nothing; the bonus counts the last 7 days', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.eval(() => { window.__G.mode = 'play'; });
    assert.equal(await streak(g), 0);
    assert.deepEqual(await clearAll(g), { all: 1, streak: 1 });
    await g.eval(() => { window.__G.mode = 'play'; });
    assert.match(await g.eval(() => window.__GDLY.lines()), /all three cleared on 1 of the last 7 days/);
    // the next day: yesterday counts (+10%)
    await goTo(g, T0 + DAY);
    assert.equal(await streak(g), 1);
    assert.deepEqual(await clearAll(g), { all: 1, streak: 2 });
    await g.eval(() => { window.__G.mode = 'play'; });
    // a day missed (the 7th): the 8th still has both days, where the old streak went back to 0
    await goTo(g, T0 + 3 * DAY);
    assert.equal(await streak(g), 2, 'nothing lost for the missed day');
    // the bonus follows: two days, +20%
    const [r2, r0] = await g.eval(() => { const x = window.__GU.dailyList()[0], a = window.__GDLY.reward(x), S = window.__G.S, W = S.dlyW; S.dlyW = []; S.dly.streak = 0; const b = window.__GDLY.reward(x); S.dlyW = W; S.dly.streak = 2; return [a, b]; });
    assert.equal(r2.g, Math.round(r0.g * 1.2), 'two days: +20%');
    // a week after the second one, both have rolled off
    await goTo(g, T0 + 8 * DAY);
    assert.equal(await streak(g), 1, 'the 5th is more than 7 days back, the 6th is not');
    await goTo(g, T0 + 9 * DAY);
    assert.equal(await streak(g), 0);
    assert.deepEqual(await g.eval(() => window.__GDLY.W), ['2026-01-05', '2026-01-06']);

    // an old save: 3 days in a row up to yesterday, and no list of days
    await g.eval(() => { const S = window.__G.S; delete S.dlyW; S.dly = { day: '2026-01-13', c: {}, done: {}, all: 1, streak: 3 }; });
    await goTo(g, Date.UTC(2026, 0, 14, 9));
    assert.equal(await streak(g), 3);
    assert.deepEqual(await g.eval(() => window.__GDLY.W), ['2026-01-11', '2026-01-12', '2026-01-13']);
    // its last day not cleared: the streak ended the day before
    await g.eval(() => { const S = window.__G.S; delete S.dlyW; S.dly = { day: '2026-01-14', c: {}, done: {}, all: 0, streak: 2 }; });
    await goTo(g, Date.UTC(2026, 0, 15, 9));
    assert.equal(await streak(g), 2);
    assert.deepEqual(await g.eval(() => window.__GDLY.W), ['2026-01-12', '2026-01-13']);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
