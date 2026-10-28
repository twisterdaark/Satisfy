'use strict';
// U292 Harvest fair (SAT-ONLINE-187; plan: "farm yield challenge with categories", check: "no infinite repeating plot
// exploit"):
//   - a harvest weighs its best piece; the week's heaviest of each crop is your entry; an empty plot gives nothing;
//   - Piaro's fair board shows each crop: yours and the rival to beat;
//   - when the week is over it is judged once: a ribbon for each crop where you beat all three rivals, the title Fair
//     Champion with the first, Golden Harvest at ten; no gold, items or XP from the fair;
//   - the rivals' entries are the same for a week and a crop on every page.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const WEEK = 604800000;

test('the harvest fair: weighed harvests, the board, judged once, ribbons and titles', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, F = window.__GHF, gold = S.gold;
      S.p4 = S.p4 || { pl: [], kinds: {}, lfk: {} }; S.p4.pl[0] = { c: 'melon', t0: Date.now() - 1e9, d: 1000, n: 2, cmp: 1 };
      F.harvest(0); const wk = F.wk(), e = Object.assign({}, F.F.w[wk]);
      F.harvest(0); // the plot is empty now: nothing more
      return { wk, e, e2: Object.assign({}, F.F.w[wk]), gold: S.gold - gold, pl: S.p4.pl[0], mats: S.mats.melon, rec: F.F.cr.melon };
    });
    assert.ok(r.e.melon >= 6000 * 0.6 * 0.8 && r.e.melon <= 6000 * 1.5 * 1.12 * 1.08 * 1.1 + 1, 'a melon weighs what a melon can: ' + r.e.melon);
    assert.deepEqual(r.e2, r.e, 'an empty plot gives no entry');
    assert.equal(r.gold, 0); assert.equal(r.pl, null); assert.equal(r.mats, 2); assert.equal(r.rec, r.e.melon);
    // Piaro's board
    await g.eval(() => window.__GHF.show()); await g.step(2);
    const board = await g.eval(() => { const L = window.__G.DL.lines; return String(L[L.length - 1]); });
    assert.match(board, /Harvest fair · this week/);
    assert.match(board, /Watermelon: yours [\d.]+ kg[^·]*· to beat [\d.]+ kg \((Old Tarek|Mistress Saba|Young Faris)\)/);
    await g.page.keyboard.press('Escape'); await g.step(3);
    // the week: a melon that beats them all, a wheat sheaf that doesn't
    const j = await g.eval((WEEK) => {
      const F = window.__GHF, S = window.__G.S, wk = F.wk(), E = F.F.w[wk];
      E.melon = F.rival(wk, 'melon')[0].g + 1; E.wheat = F.rival(wk, 'wheat')[0].g - 1;
      const now0 = F.judge(); // this week isn't over: nothing
      const real = Date.now; Date.now = () => real() + WEEK;
      const res = F.judge(), again = F.judge();
      return { now0, res, again, rb: F.F.rb, t1: !!S.tl.fairc, t2: !!S.tl.fairg };
    }, WEEK);
    assert.deepEqual(j.now0, []);
    assert.equal(j.res.length, 1);
    assert.match(j.res[0], /you won 1 blue ribbons of 2/);
    assert.match(j.res[0], /Watermelon: [\d.]+ kg beat [\d.]+ kg 🎀/);
    assert.match(j.res[0], /Wheat: [\d.]+ kg against [\d.]+ kg/);
    assert.deepEqual(j.again, [], 'judged once');
    assert.deepEqual([j.rb, j.t1, j.t2], [1, true, false]);
    // ten ribbons: Golden Harvest
    const k = await g.eval((WEEK) => {
      const F = window.__GHF, S = window.__G.S; F.F.rb = 9; const wk = F.wk(); (F.F.w[wk] = {}).pumpk = F.rival(wk, 'pumpk')[0].g + 5;
      const real = Date.now; Date.now = () => real() + WEEK; const res = F.judge(); return { res, rb: F.F.rb, t2: !!S.tl.fairg };
    }, WEEK);
    assert.equal(k.res.length, 1); assert.deepEqual([k.rb, k.t2], [10, true]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the rivals are the same for a week and a crop everywhere', async () => {
  const a = await H.openGame({}), b = await H.openGame({});
  try {
    const q = (g) => g.eval(() => ['wheat', 'straw', 'melon', 'pumpk', 'fcab'].map((c) => window.__GHF.rival(2900, c).map((x) => x.i + ':' + x.g).join(',')));
    const ra = await q(a), rb = await q(b);
    assert.deepEqual(ra, rb);
    assert.notDeepEqual(ra, await a.eval(() => ['wheat', 'straw', 'melon', 'pumpk', 'fcab'].map((c) => window.__GHF.rival(2901, c).map((x) => x.i + ':' + x.g).join(','))), 'another week, other entries');
  } finally { await a.close(); await b.close(); }
});
