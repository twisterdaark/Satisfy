'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('boots to the language picker on first launch, no page errors', async () => {
  const g = await H.openGame({ storage: { satisfy_lang: null } });
  try {
    assert.equal(await g.mode(), 'lang');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('boots to the title screen when a language is saved; Continue disabled without a save', async () => {
  const g = await H.openGame();
  try {
    assert.equal(await g.mode(), 'title');
    assert.equal(await g.eval(() => document.getElementById('contBtn').disabled), true);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('offline: new game plays with no auth or backend requests', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(60);
    assert.equal(await g.mode(), 'play');
    const allowed = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
    const hosts = [...new Set(g.external.map((u) => new URL(u).hostname))];
    assert.deepEqual(hosts.filter((h) => !allowed.has(h)), []);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
