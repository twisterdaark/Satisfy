'use strict';
// U289 Inn rest (SAT-ONLINE-168; plan: "logout point bonus with anti-farm caps", check: "offline time using server clock").
//   - sleeping at an inn and logging out soon after: back after 16 hours, a rested pool of 10% of the level (5% for 8 h);
//   - while it lasts a monster kill gives its XP twice, and the pool goes down by the extra;
//   - the caps: logged out more than 30 min after sleeping, away under 30 min, a clock that went back: nothing; at most
//     3 days count; at most 1.5 levels; the mark is used once;
//   - the whole way: sleep, save, the time away in the save, Continue: rested, shown in the status window.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const HOUR = 3600000;

test('inn rest: the pool from the time away, double XP from kills, and the caps', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.eval(() => { window.__G.S.lv = 40; window.__G.S.gold = 1e6; window.__GINN.rest('inn', 0); });
    for (let i = 0; i < 20 && !(await g.eval(() => window.__G.S.inn > 0)); i++) await g.step(30); // the fade, then the night
    const marked = await g.eval(() => window.__G.S.inn > 0);
    const r = await g.eval((HOUR) => {
      const I = window.__GINN, G = window.__G, S = G.S, o = {};
      const away = (sinceRest, off) => { const now = Date.now(); S.svT = now - off; S.inn = S.svT - sinceRest; S.rx = 0; return I.wake(); };
      // 16 h away, logged out 5 min after sleeping: 5% of a level per 8 h = 10%
      o.n16 = away(5 * 60000, 16 * HOUR); o.pool16 = S.rx;
      // a kill's XP twice, the pool down by the extra
      const before = S.rx; o.kill = I.xp(100); o.left = before - S.rx;
      // logged out 2 h after sleeping: nothing; 10 min away: nothing; a clock that went back: nothing
      o.late = away(2 * HOUR, 16 * HOUR); o.short = away(60000, 10 * 60000); o.back = away(60000, -5 * HOUR);
      // a month away: 3 days count (5% x 9 = 45% of a level)
      o.month = away(60000, 30 * 24 * HOUR);
      // used once: the mark is gone
      S.rx = 0; o.again = I.wake();
      // the cap: 1.5 levels, however it adds up
      let tot = 0; for (let i = 0; i < 6; i++) { const now = Date.now(); S.svT = now - 30 * 24 * HOUR; S.inn = S.svT - 60000; tot = I.wake(); }
      o.capped = S.rx; o.capAdd = tot;
      return o;
    }, HOUR);
    const need = await g.eval(() => window.__GINN.need());
    assert.equal(marked, true, 'sleeping marks the time');
    assert.ok(r.n16 > 0 && Math.abs(r.pool16 / need - 0.1) < 0.01, '16 h: 10% of the level: ' + r.pool16 + ' of ' + need);
    assert.equal(r.kill, 200, 'a kill of 100 XP gives 200');
    assert.equal(r.left, 100);
    assert.deepEqual([r.late, r.short, r.back], [0, 0, 0], 'too late after sleeping, too short, a clock gone back');
    assert.ok(Math.abs(r.month / need - 0.45) < 0.01, 'a month counts as 3 days: ' + r.month);
    assert.equal(r.again, 0, 'used once');
    assert.ok(Math.abs(r.capped / need - 1.5) < 0.01, 'at most 1.5 levels: ' + r.capped);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the whole way: sleep at the inn, save, 16 hours away in the save, Continue: rested, in the status window', async () => {
  const ctx = await H.newContext();
  try {
    let g = await H.openGame({ ctx });
    await H.newGame(g);
    await g.eval(() => { const S = window.__G.S; S.lv = 40; S.gold = 1e6; window.__GINN.rest('inn', 0); });
    await g.page.waitForTimeout(400); await g.step(90); // the fade runs on a real 300 ms timer (a step runs no timers), then the save
    const saved = await g.eval(() => { const S = window.__G.S; window.__GINN.save(); return { inn: S.inn, svT: S.svT }; });
    assert.ok(saved.inn > 0 && saved.svT >= saved.inn, JSON.stringify(saved));
    // 16 hours pass: the save's clocks move back by that much
    await g.eval((H16) => { for (const k of Object.keys(localStorage)) { if (!/^satisfy_proto/.test(k)) continue; const o = JSON.parse(localStorage.getItem(k)); if (!o || !o.S) continue; o.S.inn -= H16; o.S.svT -= H16; localStorage.setItem(k, JSON.stringify(o)); } }, 16 * 3600000);
    await g.close();
    g = await H.openGame({ ctx });
    await H.continueGame(g);
    await g.step(90);
    const r = await g.eval(() => ({ rx: window.__G.S.rx, inn: window.__G.S.inn }));
    assert.ok(r.rx > 0, 'rested: ' + r.rx);
    assert.equal(r.inn, 0, 'the mark is used');
    await g.page.keyboard.press('c'); await g.step(3);
    assert.match(await g.page.textContent('#statusW'), /Rested XP/);
    assert.deepEqual(g.errors, []);
    await g.close();
  } finally { await ctx.close(); }
});
