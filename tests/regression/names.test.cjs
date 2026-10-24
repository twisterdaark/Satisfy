'use strict';
// Owner 2026-10-24: names and chat filtered; a name that is an insult must be changed before playing on; a Name Change Card
// from the stylist changes your name.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./../harness/game.cjs');
test.after(() => H.closeBrowser());

test('names: insults refused, shown as stars, a bad name must be changed, the card renames', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => { const N = window.__GNM; return { a: N.bad('Jewnigger'), b: N.bad('Grid'), c: N.bad('Dickson'), d: N.show('Jewnigger'), e: N.show('Twister') }; });
    assert.deepEqual(r, { a: true, b: false, c: false, d: '★★★★★★★★★', e: 'Twister' });
    // a character named with an insult: a prompt that won't take another insult
    await g.eval(() => { window.__G.S.look.n = 'FuckYou'; window.__GNM.force(); });
    await g.step(3);
    assert.equal(await g.eval(() => !!document.getElementById('gnBox')), true, 'asked for a new name');
    await g.page.fill('#gnBox input', 'shitlord'); await g.page.keyboard.press('Enter'); await g.step(8);
    assert.equal(await g.eval(() => window.__G.S.look.n), 'FuckYou', 'an insult is refused');
    assert.equal(await g.eval(() => !!document.getElementById('gnBox')), true, 'and asked again');
    await g.page.fill('#gnBox input', 'Kassem'); await g.page.keyboard.press('Enter'); await g.step(3);
    assert.equal(await g.eval(() => window.__G.S.look.n), 'Kassem');
    // the card: bought for gold, used from the bag
    await g.eval(() => { window.__G.S.gold = 100000; window.__GNM.buy(); window.__GNM.use(); });
    await g.step(3);
    await g.page.fill('#gnBox input', 'Mithy'); await g.page.keyboard.press('Enter'); await g.step(3);
    const c = await g.eval(() => ({ n: window.__G.S.look.n, card: window.__G.S.mats.rncard || 0, gold: window.__G.S.gold }));
    assert.deepEqual(c, { n: 'Mithy', card: 0, gold: 50000 });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
