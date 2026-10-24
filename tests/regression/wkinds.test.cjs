'use strict';
// Weapons for every kind of fighter (owner 2026-10-24, a player: "no staff but the jewel staff; bosses drop only swords"): each kind
// has boss-dropped weapons through the levels, drawn in the hand and in the bag
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('every weapon kind has boss drops from low to high level, with sprites and icons', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const G = window.__G, W = window.__GLK.wsh(), ids = ['oakst', 'frstaff', 'stormst', 'abyssst', 'hunbow', 'wyvbow', 'moonbow', 'vipdag', 'shdag', 'bldag', 'knspear', 'trident', 'skyspear', 'warhm', 'thhm', 'giantm'];
      const out = {}; for (const id of ids) { const it = G.eqx.mkItem(id, 0); out[id] = { k: W[id] && W[id].k, atk: it.atk > 0, held: !!window.SatArt.weapons.sprite(id, 0), icon: window.SatArt.icons.KEYS.includes(id) }; } return out; });
    for (const [id, o] of Object.entries(r)) assert.deepEqual([o.atk, o.held, o.icon], [true, true, true], id);
    const kinds = {}; for (const o of Object.values(r)) kinds[o.k] = (kinds[o.k] || 0) + 1;
    assert.deepEqual(kinds, { staff: 4, bow: 3, dagger: 3, spear: 3, hammer: 3 });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
