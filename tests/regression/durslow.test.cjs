'use strict';
// Durability (owner 2026-10-22, "make the weapon break slower"): a hit rolls 4% (armour 7% per hit taken), rarer gear
// wears slower (legendary 0.4 times as often), and hits landed in the same frame (one AoE skill) roll only once.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('weapons wear about 4% a hit, legendary slower, one roll per AoE frame', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const G = window.__G, X = G.eqx, rc = Satisfy.local.defs().RC.find((x) => x.slot === 'w' && x.atk && x.fix == null);
      const n = X.mkItem(rc.id, 0), l = X.mkItem(rc.id, 4); n.dur = l.dur = 1e6;
      for (let k = 0; k < 20000; k++) { X.wear(n, .04); X.wear(l, .04); }
      return { n: 1e6 - n.dur, l: 1e6 - l.dur }; });
    assert.ok(r.n > 650 && r.n < 950, 'normal weapon lost ' + r.n + ' of 20000 rolls');
    assert.ok(r.l > 220 && r.l < 420, 'legendary weapon lost ' + r.l + ' of 20000 rolls');
    const a = await g.eval(() => { const G = window.__G, S = G.S, X = G.eqx, rc = Satisfy.local.defs().RC.find((x) => x.slot === 'w' && x.atk && x.fix == null); if (!X.eqIt('w')) { const it = X.mkItem(rc.id, 0); S.items.push(it); X.equip(it); } const w = X.eqIt('w'); w.dur = 1e6;
      const ms = []; for (let k = 0; k < 40; k++) { const m = G.spawnMon('slime', G.P.x + 40, G.P.y); m.tmp = 0; m.hp = m.max = 1e9; ms.push(m); }
      const o = Math.random; Math.random = () => 0; try { for (const m of ms) window.__GU.hitMon(m, 1); } finally { Math.random = o; }
      return 1e6 - w.dur; });
    assert.equal(a, 1, '40 hits in one frame wore the weapon ' + a + ' times');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
