'use strict';
// Leveling pace (owner 2026-10-22). "I went from 1 to 172 in an hour", then "50 hours to 100 is far too long, and take
// the per-kill cap away": one kill gives its whole XP again (at most 1.3 times it from a monster far above you, instead
// of the old 2 times), and the curve asks about 63 thousand XP at level 100 (33 thousand before, 386 thousand in v1.82).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('no per-kill cap: a far higher monster gives 1.3 times its XP; level 100 needs about 63 thousand', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const G = window.__G, S = G.S, U = window.__GU; S.lv = 100; S.xp = 0;
      const xp = G.isk.MT.lizard.xp, m = G.spawnMon('lizard', G.P.x + 30, G.P.y); m.tmp = 0; m.lv = 140; const x0 = S.xp, l0 = S.lv; U.killMon(m);
      const got = S.xp - x0 + (S.lv > l0 ? 1e12 : 0); S.lv = 100; S.xp = 0; return { xp, got, need: G.xpNeed() }; });
    assert.ok(r.got >= Math.round(r.xp * 1.3), 'a level-140 kill at level 100 gave ' + r.got + ' of ' + r.xp);
    assert.ok(r.need > 55000 && r.need < 70000, 'level 100 needs ' + r.need);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
