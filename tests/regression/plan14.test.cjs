'use strict';
// Plan batch 14 (owner 2026-10-26 21:35: "keep making updates, don't stop"): U078 the balance board checks each week that
// the Magic Swordsman (a hybrid) stays under the strongest pure class of a like level.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the balance board: the hybrid against the strongest pure class of a like level', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const X = window.__GPB12, wk = 'w1', rec = (cls, lv, n, s) => ({ wk, cls, lv, n, s, w: 0, l: 0 });
      const run = (all) => X.balHyb(X.balStats(all, wk)).map((h) => [h.c, h.best, h.over, h.pct]);
      const base = { a: rec('knight', 150, 100, 400), b: rec('warlock', 155, 80, 280), c: rec('ranger', 90, 200, 100), d: rec('sniper', 152, 20, 20) };
      return {
        under: run({ ...base, h: rec('bmage', 150, 60, 240) }),            // 4.0 s each against the warlock's 3.5 s
        over: run({ ...base, h: rec('bmage', 150, 60, 150) }),             // 2.5 s: 40% faster than the warlock
        few: run({ ...base, h: rec('bmage', 150, 10, 10) }),               // too few kills to judge
        none: run({ a: rec('knight', 300, 100, 400), h: rec('bmage', 150, 60, 150) }),   // nobody of a like level
      };
    });
    assert.deepEqual(r.under, [['bmage', 'warlock', false, -12]], 'it holds: the ranger (another level) and the sniper (few kills) don\'t count');
    assert.deepEqual(r.over, [['bmage', 'warlock', true, 40]], 'it kills faster: flagged');
    assert.deepEqual(r.few, []); assert.deepEqual(r.none, []);
    const lines = await g.eval(() => { const t = window.__G.lines().en; return [t.admBalHyb, t.admBalHybOk]; });
    assert.ok(lines.every((l) => typeof l === 'string' && /\{c\}/.test(l)), 'both lines in English');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
