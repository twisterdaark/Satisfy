'use strict';
// Owner 2026-10-24: the stylist as a customization screen like the guild window: tabs per category, the parts of the tab, and
// that part's choices in a grid; buying a change keeps you on the same tab.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./../harness/game.cjs');
test.after(() => H.closeBrowser());

test('stylist: five tabs, parts under them, a change keeps the tab', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.eval(() => { window.__G.S.gold = 1e6; window.__GLOOK.sty('hair'); });
    await g.step(4);
    const tabs = () => g.eval(() => ({ top: [...document.querySelectorAll('#dopts .sttop button')].length, on: (document.querySelector('#dopts .sttop button.on') || {}).textContent, sub: (document.querySelector('#dopts .stsub button.on') || {}).textContent || '' }));
    let t0 = await tabs();
    assert.equal(t0.top, 5);
    // Clothes, then Outfits
    await g.page.click('#dopts .sttop button:nth-child(4)'); await g.step(3);
    await g.page.click('#dopts .stsub button:last-child'); await g.step(3);
    const cos = await g.eval(() => document.querySelectorAll('#dopts .dcell').length);
    assert.ok(cos >= 20, 'the outfits grid: ' + cos);
    // Hair colour: buy one, still on the hair colour tab
    await g.eval(() => window.__GLOOK.sty('hc')); await g.step(3);
    const hc0 = await g.eval(() => window.__G.S.look.hc | 0);
    await g.page.click(`#dopts .dcell:nth-child(${hc0 === 3 ? 6 : 5})`); await g.step(3);   // grid cells come after the tab block
    const after = await g.eval(() => ({ hc: window.__G.S.look.hc | 0, sub: (document.querySelector('#dopts .stsub button.on') || {}).textContent || '', open: !document.getElementById('dialog').hidden }));
    assert.notEqual(after.hc, hc0, 'the colour changed');
    assert.ok(after.open && /colour|لون/i.test(after.sub), 'still on the hair colour tab: ' + JSON.stringify(after));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
