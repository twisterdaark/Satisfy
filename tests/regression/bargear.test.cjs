'use strict';
// owner 2026-10-22: rings, gear and things you use go on the main bar too. Pressing a piece puts it on; pressing it again
// takes it off and puts back what it replaced. Food and potions are used and show how many are left.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('main bar: gear on and off with the old piece back, a potion used, worn frame', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const G = window.__G, S = G.S, E = G.eqx;
      const a = E.mkItem('cring', 0), b = E.mkItem('mring', 1); S.items.push(a, b); E.equip(a);
      S.bar = [null, null, null, null, null]; S.bar[1] = 'g:' + b.uid; S.bar[2] = 'hpot'; S.hpot = 3;
      // fill the nine ring slots so the new ring must replace the accessory one (all nine open from level 450)
      S.lv = 450;
      for (let i = 0; i < 9; i++) { const x = E.mkItem('cring', 0); S.items.push(x); E.equip(x); }
      const kept = S.bar.slice(); G.useSlot(1); const on = [S.eq.k === b.uid, Object.values(S.eq).includes(a.uid)];
      G.useSlot(1); const off = [Object.values(S.eq).includes(b.uid), S.eq.k === a.uid];
      const hp0 = S.hpot; G.P.hp = 1; G.useSlot(2); const hp1 = S.hpot;
      G.useSlot(1); window.__G.step ? 0 : 0; return { kept, on, off, hp0, hp1 }; });
    assert.deepEqual(r.on, [true, false], 'the new ring replaced the accessory one: ' + JSON.stringify(r));
    assert.deepEqual(r.off, [false, true], 'pressed again: off, and the old ring is back');
    assert.equal(r.hp1, r.hp0 - 1, 'a potion is drunk');
    await g.step(3);
    const html = await g.eval(() => [document.querySelector('#skillbar [data-sk="1"]').className, !!document.querySelector('#skillbar [data-sk="1"] img')]);
    assert.match(html[0], /eqd/, 'worn frame');
    assert.ok(html[1]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a ring dragged from the open bag onto the main bar lands there', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.eval(() => { const G = window.__G, S = G.S; S.items.push(G.eqx.mkItem('cring', 0)); S.bar = [null, null, null, null, null]; });
    await g.step(3); await g.page.keyboard.press('KeyI'); await g.step(3);
    const bar = await g.eval(() => { const i = window.__G.bag().INVS.findIndex((s) => s.k === 'cring'), dt = new DataTransfer(), src = document.querySelector(`#igrid [data-inv="${i}"]`);
      src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); const dst = document.querySelector('#skillbar [data-sk="3"]');
      dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt })); return window.__G.S.bar; });
    assert.match(String(bar[3]), /^g:\d+$/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
