'use strict';
// Owner 2026-10-23: a player wore gear above their level by picking it in the equipment window (U): the picker put the item
// on without the level check equipping from the bag has. Both ways now refuse it, and a level high enough wears it.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./../harness/game.cjs');
test.after(() => H.closeBrowser());

test('gear above your level: refused from the equipment window and from the bag, worn once you reach it', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const uid = await g.eval(() => { const G = window.__G, S = G.S; S.lv = 10; S.cls = 'novice'; const it = G.eqx.mkItem('gale', 1); S.items.push(it); return it.uid; });
    // the picker in the equipment window
    await g.eval(() => { window.__G.eqx.openEquip(); window.__G.openPick('w'); });
    await g.page.click(`#eqPick [data-pick="${uid}"]`);
    assert.notEqual(await g.eval(() => window.__G.S.eqW), uid, 'the picker refused it at level 10');
    // from the bag
    assert.equal(await g.eval((u) => { const G = window.__G; G.eqx.equip(G.S.items.find((i) => i.uid === u)); return G.S.eqW === u; }, uid), false, 'the bag refused it too');
    // at level 120 it goes on
    await g.eval(() => { window.__G.S.lv = 120; window.__G.openPick('w'); });
    await g.page.click(`#eqPick [data-pick="${uid}"]`);
    assert.equal(await g.eval(() => window.__G.S.eqW), uid, 'worn at level 120');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
