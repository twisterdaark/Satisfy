'use strict';
// Leveling pace (owner 2026-10-22: "I went from 1 to 172 in an hour"). A monster far above you gives at most 1.3 times
// its XP, and one kill never gives more than 12% of a level (half a level for a boss), so killing high monsters with
// strong gear cannot jump dozens of levels at once.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('a level 1 killing level-130 monsters gains a level slowly, not dozens', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const G = window.__G, S = G.S, U = window.__GU; S.lv = 1; S.xp = 0;
      for (let i = 0; i < 40; i++) { const m = G.spawnMon('lizard', G.P.x + 30, G.P.y); m.tmp = 0; U.killMon(m); }
      return { lv: S.lv }; });
    assert.ok(r.lv <= 6, 'forty level-130 kills took a level 1 to ' + r.lv);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
