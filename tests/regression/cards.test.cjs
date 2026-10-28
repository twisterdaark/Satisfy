'use strict';
// U296 Card minigame (SAT-ONLINE-181; plan: "non-real-money fixed local rewards", check: "age-appropriate, no gambling
// currency"): Three Crowns at the inns.
//   - the innkeeper offers it; it opens its own window, five cards in hand, five face down across;
//   - the suits: Sword beats Magic, Magic beats Shield, Shield beats Sword, the beaten card loses 3;
//   - a card a round (a click or 1-5), the higher takes the crown; two crowns win;
//   - nothing is staked or paid (no gold, no items); a win counts, and 10 wins give a title to show;
//   - Esc closes it.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('Three Crowns: from the innkeeper, the suits, two crowns win, no gold, the title at 10 wins', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    assert.ok((await g.eval(() => window.__GRS.inn('inn'))).includes('🃏 Play Three Crowns'), "the innkeeper's option");
    // the suits
    const sc = await g.eval(() => { const s = window.__GCG.score; return [s({ s: 'sw', v: 3 }, { s: 'mg', v: 5 }), s({ s: 'mg', v: 5 }, { s: 'sw', v: 3 }), s({ s: 'mg', v: 2 }, { s: 'sh', v: 4 }), s({ s: 'sh', v: 4 }, { s: 'mg', v: 2 }), s({ s: 'sh', v: 1 }, { s: 'sw', v: 3 }), s({ s: 'sw', v: 3 }, { s: 'sw', v: 3 })]; });
    assert.deepEqual(sc, [3, 2, 2, 1, 1, 3], 'Sword beats Magic, Magic beats Shield, Shield beats Sword; the same suit plain');
    const gold = await g.eval(() => window.__G.S.gold);
    await g.eval(() => window.__GCG.open()); await g.step(2);
    assert.equal(await g.eval(() => window.__G.mode), 'cards');
    assert.deepEqual(await g.eval(() => [document.querySelectorAll('#cgW [data-cgp]').length, document.querySelectorAll('#cgW .cgc.back').length, document.getElementById('cgW').hidden]), [5, 5, false]);
    // a fixed deal: every card of yours beats every one of theirs
    await g.eval(() => window.__GCG.set([{ s: 'sw', v: 5 }, { s: 'sh', v: 5 }, { s: 'mg', v: 5 }, { s: 'sw', v: 4 }, { s: 'sh', v: 4 }], [{ s: 'sw', v: 1 }, { s: 'sh', v: 1 }, { s: 'sw', v: 2 }, { s: 'sh', v: 2 }, { s: 'sw', v: 1 }]));
    await g.eval(() => window.__GCG.play(0)); await g.step(2);
    // the cards are laid face up in the middle
    assert.equal(await g.eval(() => document.querySelectorAll('#cgW .cgmid .cgc:not(.ghost)').length), 2);
    for (let i = 0; i < 10 && await g.eval(() => window.__GCG.G.busy); i++) { await g.step(10); await g.page.waitForTimeout(80); }
    assert.equal(await g.eval(() => window.__GCG.G.cm), 1, 'the first crown');
    await g.page.keyboard.press('Digit2'); await g.step(2);
    for (let i = 0; i < 10 && await g.eval(() => window.__GCG.G.busy); i++) { await g.step(10); await g.page.waitForTimeout(80); }
    const end = await g.eval(() => ({ over: window.__GCG.G.over, fin: window.__GCG.G.fin, st: window.__GCG.st(), msg: document.querySelector('#cgW .cgmsg').textContent }));
    assert.deepEqual([end.over, end.fin, end.st.w, end.st.p], [true, 'w', 1, 1]);
    assert.match(end.msg, /You win the game/);
    assert.equal(await g.eval(() => window.__G.S.gold), gold, 'nothing staked, nothing paid');
    // the tenth win: the title
    await g.eval(() => { window.__GCG.st().w = 9; window.__GCG.again(); window.__GCG.set([{ s: 'sw', v: 5 }, { s: 'sw', v: 5 }, { s: 'sw', v: 5 }, { s: 'sw', v: 5 }, { s: 'sw', v: 5 }], [{ s: 'mg', v: 1 }, { s: 'mg', v: 1 }, { s: 'mg', v: 1 }, { s: 'mg', v: 1 }, { s: 'mg', v: 1 }]); window.__GCG.play(0); });
    for (let i = 0; i < 10 && await g.eval(() => window.__GCG.G.busy); i++) { await g.step(10); await g.page.waitForTimeout(80); }
    await g.eval(() => window.__GCG.play(0));
    for (let i = 0; i < 10 && await g.eval(() => window.__GCG.G.busy); i++) { await g.step(10); await g.page.waitForTimeout(80); }
    assert.equal(await g.eval(() => window.__GCG.st().w), 10);
    assert.equal(await g.eval(() => !!window.__G.S.tl.cardsh), true, 'Card Sharp');
    // Esc closes it
    await g.page.keyboard.press('Escape'); await g.step(2);
    assert.deepEqual(await g.eval(() => [window.__G.mode, document.getElementById('cgW').hidden]), ['play', true]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
