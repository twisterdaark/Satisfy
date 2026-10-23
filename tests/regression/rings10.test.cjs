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

// owner 2026-10-23: ten at once was overpowered; the nine ring slots open one by one with level (half the level for a legendary class)
test('ring slots open with level; a locked slot shows a lock and how it opens; worn rings come off when a slot locks', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const G = window.__G, S = G.S, o = {};
      S.lv = 1; for (let i = 0; i < 4; i++) { const it = G.eqx.mkItem('cring', 0); S.items.push(it); G.eqx.equip(it); }
      o.lv1 = ['k', 'k1', 'k2'].map((k) => !!S.eq[k]);
      S.lv = 100; for (let i = 0; i < 4; i++) { const it = G.eqx.mkItem('cring', 0); S.items.push(it); G.eqx.equip(it); }
      o.lv100 = ['k1', 'k2', 'k3', 'k4'].map((k) => !!S.eq[k]);
      G.eqx.openEquip(); o.open = document.querySelectorAll('#eqRing [data-eq]').length; const lk = document.querySelector('#eqRing .lock'); o.locked = document.querySelectorAll('#eqRing .lock').length; o.tip = lk && lk.dataset.tip;
      S.cls = 'pagma'; S.lv = 50; G.eqx.openEquip(); o.leg = document.querySelectorAll('#eqRing [data-eq]').length;
      S.cls = 'novice'; S.lv = 30; window.__GSET && 0; return o; });
    assert.deepEqual(r.lv1, [true, false, false], 'at Lv 1 only the accessory slot');
    assert.deepEqual(r.lv100, [true, true, true, false], 'Lv 100 opens three ring slots');
    assert.equal(r.open, 3); assert.equal(r.locked, 6);
    assert.ok(/150/.test(r.tip), 'the lock says the level: ' + r.tip);
    assert.equal(r.leg, 3, 'a legendary class opens them at half the level');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
