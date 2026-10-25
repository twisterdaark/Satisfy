'use strict';
// owner 2026-10-25: "An error was caught: Failed to execute 'createLinearGradient' ... non-finite" (a screenshot on the
// National Competition grounds). A gradient from a number gone NaN no longer throws: the number is taken as 0 and the call is
// noted (window.__GNF) with where it came from; ordinary gradients are untouched.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('a gradient from NaN does not stop the frame; it is noted', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const c = document.createElement('canvas'), x = c.getContext('2d'), out = {};
      try { x.createLinearGradient(0, NaN, 0, 10); x.createRadialGradient(NaN, 0, 0, 0, 0, Infinity); out.threw = false; } catch (e) { out.threw = e.message; }
      const ok = x.createLinearGradient(0, 0, 0, 10); ok.addColorStop(0, '#fff'); out.ok = !!ok;
      out.noted = (window.__GNF || []).length;
      return out;
    });
    assert.equal(r.threw, false);
    assert.equal(r.ok, true);
    assert.equal(r.noted, 2);
    await g.step(30);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
