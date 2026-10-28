'use strict';
// Behen islands (owner 2026-10-22): the fire island showed only 7 blazes, some inside trees you cannot cut. Now its 12
// blazes stand on walkable tiles beside the burning trees, apart from each other, and every island spawn (keys, monsters,
// blazes) is on a tile you can walk to from where you land. Floating numbers show whole numbers ("+398.489000001").
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('every Behen spawn is reachable; the fire island has 12 separate blazes', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const X = window.__GBH, G = window.__G, TS = 16, out = { fire: [], bad: 0, n: 0 };
      for (const B of X.B) { const rch = X.reach(B);
        for (let i = 0; i < 20; i++) { const p = X.spot(B, 6), k = Math.floor(p.x / TS) + ',' + Math.floor(p.y / TS); out.n++; if (!rch.has(k)) out.bad++; }
        if (B.k === 'fire') { const F = X.fires(B), keys = F.map((p) => Math.floor(p.x / TS) + ',' + Math.floor(p.y / TS));
          out.fire.push({ n: F.length, uniq: new Set(keys).size, reach: keys.every((k) => rch.has(k)) }); } }
      return out; });
    assert.ok(r.n > 100); assert.equal(r.bad, 0, 'spawns off the walkable area');
    assert.ok(r.fire.length >= 1);
    for (const f of r.fire) { assert.equal(f.n, 12); assert.equal(f.uniq, 12); assert.ok(f.reach); }
    const n = await g.eval(() => { const X = window.__GBH; return [X.num('+398.48900000001413'), X.num(12.6), X.num('CRIT'), X.num('+1,250')]; });
    assert.deepEqual(n, ['+398', 13, 'CRIT', '+1,250']);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
