'use strict';
// owner 2026-10-23: "the wealth ranking should use the bank's gold too, and the legends ranking should say the rest of the legends"
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('wealth counts the bank; the legends list has every legendary class', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const w = await g.eval(() => { const S = window.__G.S; S.gold = 1000; S.bank = 5000000; return window.__GK2.list('gold'); });
    assert.match(w, /★ [^\n]* · 5,001,000 G/);
    await g.eval(() => window.__G.talkNPC('ranker')); await g.step(3);
    const n = await g.eval(() => { const b = [...document.querySelectorAll('#dopts button')].find((e) => /legend/i.test(e.textContent)); b.click(); return 1; });
    await g.step(2);
    const txt = await g.eval(() => document.getElementById('dtext').textContent + '|' + document.getElementById('dname').textContent);
    assert.match(txt, /legends are still unclaimed/);
    assert.match(txt, /Pagma/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
