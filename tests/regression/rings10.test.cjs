'use strict';
// owner 2026-10-22: as in the novel ("the ten rings on Kraugel's fingers"), you wear up to ten rings: the accessory slot and nine ring slots.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('ten rings: the accessory slot then nine ring slots; rings only; their damage adds up', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const G = window.__G, S = G.S, X = window.__GSET;
      S.lv = 500; const d0 = X.gearSum('dm'); const rs = [];
      for (let i = 0; i < 11; i++) { const it = G.eqx.mkItem('cring', 0); S.items.push(it); G.eqx.equip(it); rs.push(it.uid); }
      const d1 = X.gearSum('dm'), worn = ['k', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9'].map((k) => S.eq[k] || 0);
      const neck = G.eqx.mkItem('wtneck', 0); S.items.push(neck); G.eqx.equip(neck);
      G.eqx.openEquip(); const slots = document.querySelectorAll('#eqRing [data-eq]').length;
      return { d0, d1, worn, rs, neckK: S.eq.k === neck.uid, slots };
    });
    assert.equal(r.worn.filter(Boolean).length, 10, 'ten worn: ' + JSON.stringify(r));
    assert.equal(new Set(r.worn).size, 10, 'each ring once');
    assert.ok(r.d1 - r.d0 > 0.39, 'ten rings of +4% damage add up: ' + (r.d1 - r.d0));
    assert.equal(r.neckK, true, 'a non-ring accessory takes the accessory slot');
    assert.equal(r.slots, 9);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
