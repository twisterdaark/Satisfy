'use strict';
// Names (owner 2026-10-24): changing your name costs a Name Change Ticket bought from the merchants, and a name with
// words that are not allowed has to be changed (for free) before you can play on.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('name change: a ticket buys one new name; a bad name blocks play until it is fixed, for free', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g, { n: 'Grid', hair: 3, hc: 0, skin: 1, top: 1 });
    // no ticket: Settings refuses
    await g.eval(() => { window.__G.S.mats.nmtick = 0; });
    await g.page.keyboard.press('Escape'); await g.step(2);
    await g.eval(() => document.querySelector('#pauseScreen [data-act="settings"]').click()); await g.step(2);
    await g.eval(() => document.querySelector('#settingsScreen [data-act="rename"]').click()); await g.step(2);
    assert.equal(await g.eval(() => document.getElementById('idW').hidden), true, 'no ticket, no window');
    // buy one
    const r = await g.eval(() => { const S = window.__G.S; S.gold = 1e6; const o = window.__GNM.shop('merchant'); o.f(); return { n: S.mats.nmtick, gold: S.gold }; });
    assert.equal(r.n, 1);
    assert.ok(r.gold < 1e6);
    await g.eval(() => document.querySelector('#settingsScreen [data-act="rename"]').click()); await g.step(2);
    assert.equal(await g.eval(() => document.getElementById('idW').hidden), false);
    await g.eval(() => { document.getElementById('idIn').value = 'Grid2'; document.getElementById('idOk').click(); }); await g.step(2);
    assert.deepEqual(await g.eval(() => [window.__G.S.look.n, window.__G.S.mats.nmtick]), ['Grid2', 0], 'the ticket is used');
    await g.eval(() => document.querySelector('#settingsScreen [data-act="setBack"]').click()); await g.step(1);
    await g.page.keyboard.press('Escape'); await g.step(2);
    assert.equal(await g.eval(() => window.__G.mode), 'play');
    // a bad name: forced, blocks moving, free
    await g.eval(() => { window.__G.S.look.n = 'FuckYou'; window.__GNM.check(); }); await g.page.waitForTimeout(900); await g.step(2);
    assert.equal(await g.eval(() => document.getElementById('idBlk').hidden), false, 'the screen is covered');
    const x0 = await g.eval(() => window.__G.P.x);
    await g.eval(() => document.getElementById('stage').click());
    await g.page.keyboard.down('KeyD'); await g.step(30); await g.page.keyboard.up('KeyD');
    assert.equal(await g.eval(() => window.__G.P.x), x0, 'no walking away from it');
    await g.page.keyboard.press('Escape'); await g.step(2);
    assert.equal(await g.eval(() => document.getElementById('idW').hidden), false, 'Escape does not close it');
    await g.eval(() => { document.getElementById('idIn').value = 'Niceone'; document.getElementById('idOk').click(); }); await g.step(2);
    assert.deepEqual(await g.eval(() => [window.__G.S.look.n, window.__G.S.mats.nmtick, document.getElementById('idBlk').hidden]), ['Niceone', 0, true]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
