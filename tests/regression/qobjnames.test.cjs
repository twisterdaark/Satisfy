'use strict';
// No quest objective shows a code instead of a name (owner 2026-10-22: "Visit yaltar: 0/1"): in both languages the
// objective of every quest names what it asks for.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('every quest objective names its target in Arabic and English', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const bad = await g.eval(() => { const G = window.__G, Q = window.__GQD, o = [];
      for (const L of ['ar', 'en']) { Q.lang(L);
        for (const id of Object.keys(G.QD)) { const b = G.QD[id].obj; if (!b) continue; const tx = Q.obj(id);
          if (/undefined|NaN|\{\w+\}|\bo_\w/.test(tx) || (L === 'ar' && /[A-Za-z_]{3,}\s*:\s*\d+\/\d+/.test(tx)) || (!G.QD[id].ot && ['visit', 'kill', 'have', 'craft'].includes(b.t) && Q.nm(b.it) === b.it)) o.push(L + ' ' + id + ': ' + tx); } }
      Q.lang('en'); return o; });
    assert.deepEqual(bad, []);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
