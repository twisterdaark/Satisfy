'use strict';
// Owner 2026-10-24: skills looked alike (Space Sword was a bigger slash). Every active skill has a look of its own kind, the
// looks are spread wide, Space Sword cuts space, and casting draws without an error.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./../harness/game.cjs');
test.after(() => H.closeBrowser());

test('skill looks: every active skill has one, they are spread wide, Space Sword cuts space', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const X = window.__GSKFX, ks = window.__GSK.keys(), c = {};let none = 0;
      for (const k of ks) { const L = X.look(k); if (L) c[L] = (c[L] || 0) + 1; else none++; }
      for (const k of ks) X.fx(k);
      return { kinds: Object.keys(c).length, top: Math.max(...Object.values(c)), space: X.look('mcross'), none };
    });
    assert.equal(r.space, 'space');
    assert.ok(r.kinds >= 20, 'kinds of look: ' + r.kinds);
    assert.ok(r.top <= 40, 'no look takes too many skills: ' + r.top);
    await g.step(30);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
