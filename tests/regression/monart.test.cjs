'use strict';
// Owner 2026-10-23: "some monsters have no picture (the Blood Earl from vampire city 6 down is invisible); go over every
// monster and draw what is missing". Every monster type can be drawn.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('every monster has a picture', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g, { n: 'Grid', hair: 0, hc: 0, skin: 1, top: 1 });
    assert.deepEqual(await g.eval(() => window.__GMON.missing()), []);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
