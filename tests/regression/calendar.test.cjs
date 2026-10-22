'use strict';
// SAT-ONLINE-077 (plan U331): the event calendar. On the fixed clock (Monday 2026-01-05 09:40:30 UTC) and a page in Tokyo
// (UTC+9): the next world events every quarter hour, the National Competition at the next of 00, 06, 12 and 18 UTC, the siege at the next
// odd hour, the festival at :35 of the next hour with hour % 3 = 1, the horse race at :59:20; each shown in Tokyo time and
// in UTC; running ones as "now"; Trauka "up now" or "back at" from the shared world-boss time; the same list from the same
// world time whatever the device's clock says.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const T0 = Date.UTC(2026, 0, 5, 9, 40, 30);
const at = (h, m, s = 0) => Date.UTC(2026, 0, 5, h, m, s);

test('calendar: what comes next, in your time zone and UTC, from the world clock', async () => {
  const ctx = await H.newContext({ device: { timezoneId: 'Asia/Tokyo' } });
  try {
    const g = await H.openGame({ ctx });
    await H.newGame(g);
    const L = await g.eval((n) => window.__GCAL.list(n), T0);
    const by = (re) => L.filter((e) => re.test(e.k));
    const ev = by(/^evN_/);
    assert.deepEqual(ev.map((e) => e.at), [at(9, 45), at(10, 0), at(10, 15)], 'the next three world events, every quarter hour');
    assert.ok(ev.every((e) => e.end - e.at === 600000), 'ten minutes each');
    assert.deepEqual(by(/^natN$/).map((e) => [e.at, e.end]), [[at(12, 0), at(12, 30)]], 'the National Competition: every six hours (00, 06, 12, 18 UTC), half an hour');
    assert.deepEqual(by(/^sgN$/).map((e) => [e.at, e.end]), [[at(11, 0), at(11, 20)]], 'the siege: odd UTC hours, 20 min (09:00 is over)');
    assert.deepEqual(by(/^calFs$/).map((e) => [e.at, e.end]), [[at(10, 35), at(11, 0)]], 'the festival: :35 of 01, 04, 07, 10 ... UTC');
    assert.deepEqual(by(/^calRace$/).map((e) => [e.at, e.end]), [[at(9, 59, 20), at(9, 59, 56)]], 'the horse race at :59:20');
    // running ones: at 12:05 the competition is on; at 10:05 the event of 10:00
    assert.equal((await g.eval((n) => window.__GCAL.list(n), at(12, 5))).find((e) => e.k === 'natN').at, at(12, 0));
    const L2 = await g.eval((n) => window.__GCAL.list(n), at(10, 5));
    assert.equal(L2.filter((e) => /^evN_/.test(e.k))[0].at, at(10, 0));
    // after the festival hour starts but before :35, and after it
    assert.equal((await g.eval((n) => window.__GCAL.list(n), at(10, 20))).find((e) => e.k === 'calFs').at, at(10, 35));
    assert.equal((await g.eval((n) => window.__GCAL.list(n), at(11, 1))).find((e) => e.k === 'calFs').at, at(13, 35));

    // the board, in Tokyo time and UTC. The clock runs on from 09:40:30 in real time, so on a busy machine a test that takes
    // a minute sees "in N min" one less: each count may be one minute short
    assert.equal(await g.eval(() => window.__GCAL.zone()), 'UTC+9');
    await g.eval(() => window.__GCAL.board()); await g.step(2);
    const p1 = await g.eval(() => document.getElementById('dtext').textContent);
    assert.match(p1, /^Calendar \(your time, UTC\+9\) · /);
    assert.match(p1, /National Competition: 21:00 \(UTC 12:00\), in 2 h (19|20) min/);
    assert.match(p1, /: 18:45 \(UTC 09:45\), in [45] min/);
    await g.eval(() => window.__G.advance()); await g.step(2);
    const p2 = await g.eval(() => document.getElementById('dtext').textContent);
    assert.match(p2, /Siege of Reidan Castle: 20:00 \(UTC 11:00\), in 1 h (19|20) min/);
    assert.match(p2, /Town festival: 19:35 \(UTC 10:35\), in (54|55) min/);
    assert.match(p2, /Horse race: 18:59 \(UTC 09:59\), in (18|19) min/);
    assert.match(p2, /Trauka the Red Dragon: up now/);
    // Trauka killed: back half an hour later
    await g.eval((u) => { const W = window.__GU.WS; W.wb = W.wb || {}; W.wb.trauka = u; }, at(10, 10));
    await g.eval(() => window.__G.advance()); await g.step(2);
    await g.eval(() => window.__GCAL.board()); await g.step(2);
    await g.eval(() => window.__G.advance()); await g.step(2);
    assert.match(await g.eval(() => document.getElementById('dtext').textContent), /Trauka the Red Dragon: back at 19:10 \(UTC 10:10\), in (29|30) min/);
    assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
