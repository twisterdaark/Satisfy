'use strict';
// owner 2026-10-22: a set tooltip showed the raw key "setD_ez2". Every set tier has a written effect in Arabic and English.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('every set tier has its effect written in both languages', async () => {
  const g = await H.openGame();
  try {
    const miss = await g.eval(() => { const X = window.__GSET, out = [];
      for (const k in X.SETS) { if (!X.str('ar', 'set_' + k) || !X.str('en', 'set_' + k)) out.push('set_' + k);
        for (const n in X.SETS[k].b) for (const l of ['ar', 'en']) if (!X.str(l, 'setD_' + k + n)) out.push(l + ':setD_' + k + n); }
      return out; });
    assert.deepEqual(miss, []);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
