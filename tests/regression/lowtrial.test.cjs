'use strict';
// Owner 2026-10-24: a "kill while below half health" trial on a monster far under you counts kills of monsters near your level
// instead (the health condition stays), rather than dropping the condition.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./../harness/game.cjs');
test.after(() => H.closeBrowser());

test('low-health trial: a strong player counts monsters near their level, still below half health', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, E = window.__GQE.ev, c = () => S.qs.c2b.c || 0;
      S.lv = 160; S.qs.c2b = { st: 1, c: 0 };
      P.hp = 1e9; E('kill', 'wraith'); const full = c();          // near my level but at full health: no
      P.hp = 1; E('kill', 'wraith'); const low = c();              // near my level, below half: yes
      E('kill', 'goblin'); const weak = c();                       // a weak monster that isn't the quest's: no
      E('kill', 'merman'); const own = c();                        // the quest's own monster below half: still yes
      return { full, low, weak, own };
    });
    assert.deepEqual(r, { full: 0, low: 1, weak: 1, own: 2 });
  } finally { await g.close(); }
});
