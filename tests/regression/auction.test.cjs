'use strict';
// Owner 2026-10-20: the auction house opens a window like the sell window: your bag on one side (pick, amount, price,
// List), what is listed on the other (search, Buy) and your listings (Withdraw), instead of a chain of dialogs.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('auction window: list from the bag, see it under My listings, withdraw it, buy a merchant listing', async () => {
  const g = await H.openGame();
  await H.newGame(g);
  await g.eval(() => { const S = window.__G.S; S.gold = 100000; S.mats.mith = 12; window.__G.talkNPC('auction'); });
  await g.step(2);
  assert.equal(await g.mode(), 'au');
  assert.ok(await g.eval(() => !!document.querySelector('#auBag [data-auk="mith"]')), 'mithril in the bag grid');
  await g.eval(() => document.querySelector('#auBag [data-auk="mith"]').click());
  await g.eval(() => { const n = document.getElementById('auN'); n.value = '4'; n.dispatchEvent(new Event('input')); const p = document.getElementById('auP'); p.value = '999'; p.dispatchEvent(new Event('input')); document.getElementById('auGo').click(); });
  assert.equal(await g.eval(() => window.__G.S.mats.mith), 8);
  await g.eval(() => document.querySelector('#auW [data-autab="mine"]').click());
  const mine = await g.eval(() => [...document.querySelectorAll('#auL .aurow')].map((r) => r.textContent));
  assert.equal(mine.length, 1);
  assert.match(mine[0], /4×/);
  assert.match(mine[0], /999/);
  await g.eval(() => document.querySelector('#auL [data-aul]').click());
  assert.equal(await g.eval(() => window.__G.S.mats.mith), 12, 'withdrawn back to the bag');
  await g.eval(() => document.querySelector('#auW [data-autab="list"]').click());
  const before = await g.eval(() => ({ gold: window.__G.S.gold, rows: document.querySelectorAll('#auL [data-aul]').length }));
  assert.ok(before.rows > 0, 'merchants keep listings up');
  await g.eval(() => document.querySelector('#auL [data-aul]').click());
  const after = await g.eval(() => ({ gold: window.__G.S.gold, rows: document.querySelectorAll('#auL [data-aul]').length }));
  assert.ok(after.gold < before.gold, 'paid');
  assert.equal(after.rows, before.rows - 1);
  await g.page.keyboard.press('Escape'); await g.step(2);
  assert.equal(await g.mode(), 'play');
  assert.deepEqual(g.errors, []);
  await g.close();
});
