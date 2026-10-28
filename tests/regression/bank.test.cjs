'use strict';
// SAT-ONLINE-140 (plan U216 "bank deposits: deposit/withdraw idempotent", U217 "withdrawal locks: balance never negative").
// The town bank (at every inn) keeps gold in the character's own save. Each choice moves exactly what it says, taken from
// what is there at that moment: the world runs behind the menu, so gold can change while it is open, and a deposit made
// then took the menu's number (the bag went below zero and the bank got gold that wasn't there). Pressing a choice again
// moves nothing more, so gold can't be made twice; what is in the bank is still there after a reload.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const money = (g) => g.eval(() => ({ gold: window.__G.S.gold, bank: window.__G.S.bank || 0 }));
// the bank's menu at the inn; returns its option buttons by label
async function bank(g) {
  await g.eval(() => window.__GBANK.menu('inn')); await g.step(2);
  for (let i = 0; i < 4 && await g.eval(() => document.getElementById('dopts').hidden); i++) { await g.eval(() => window.__G.advance()); await g.step(2); }
  return g.eval(() => [...document.querySelectorAll('#dopts button')].map((b) => b.textContent.replace(/^\d+\.\s*/, '')));
}
// press an option of the menu now on screen, and keep its button to press it again later
const press = (g, re) => g.eval((src) => { const r = new RegExp(src), b = [...document.querySelectorAll('#dopts button')].find((x) => r.test(x.textContent)); if (!b) throw new Error('no option ' + src); window.__old = b; b.click(); }, re.source);
const again = (g) => g.eval(() => window.__old.click()); // the same button, after the menu was drawn again

test('the bank moves exactly what it says, once; neither side goes below zero; it keeps through a reload', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.eval(() => { window.__G.S.gold = 5000; window.__G.S.bank = 0; });
    assert.ok((await bank(g)).some((l) => /5,000/.test(l)), 'deposit all 5,000 on offer');

    await press(g, /5,000/); await g.step(2);
    assert.deepEqual(await money(g), { gold: 0, bank: 5000 }, 'deposited');
    await again(g); await g.step(2);
    assert.deepEqual(await money(g), { gold: 0, bank: 5000 }, 'the same deposit again: nothing, the bag not below zero');

    await bank(g);
    await press(g, /1,000/); await g.step(2);
    assert.deepEqual(await money(g), { gold: 1000, bank: 4000 }, 'withdrew 1,000');
    await bank(g);
    await press(g, /4,000/); await g.step(2);
    assert.deepEqual(await money(g), { gold: 5000, bank: 0 }, 'withdrew the rest');
    await again(g); await g.step(2);
    assert.deepEqual(await money(g), { gold: 5000, bank: 0 }, 'the same withdrawal again: no gold made, the bank not below zero');

    // half in; then the gold is spent elsewhere before the old "all" button is pressed: only what is left goes in
    await bank(g);
    await press(g, /2,500/); await g.step(2);
    assert.deepEqual(await money(g), { gold: 2500, bank: 2500 });
    await bank(g);
    await g.eval(() => { window.__old = [...document.querySelectorAll('#dopts button')].find((b) => /2,500/.test(b.textContent) && /all|كل/i.test(b.textContent)); });
    await g.eval(() => { window.__G.S.gold = 700; });
    await again(g); await g.step(2);
    assert.deepEqual(await money(g), { gold: 0, bank: 3200 }, 'only the 700 that was there');

    // through a reload
    await g.eval(() => window.__G.save(true));
    await g.page.reload(); await g.step(2);
    await H.continueGame(g);
    assert.deepEqual(await money(g), { gold: 0, bank: 3200 }, 'the bank kept');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
