'use strict';
// Tracking under the world (owner 2026-10-22: "tracking the cave goblin, or any monster in a tunnel, dungeon or hidden
// place, takes you to the sea; make sure it takes us to the place's entrance"): caves, mines and dungeons are laid out
// below the open world, so from outside the arrow must point at the surface gate into that place, never at the
// monster's own spot under the map.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('every monster under the world is tracked to a surface gate into its place', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => { const T = window.__GTRK, TS = T.TS, W = T.WMH, out = [];
      const gates = T.gates().filter((d) => d.to && !d.exit && !d.tmp && d.y < W * TS).map((d) => [d.x / TS, d.y / TS]), seen = new Set();
      for (const m of T.mons()) { if (m.dead || m.tmp || m.y < W * TS || seen.has(m.type)) continue; seen.add(m.type);
        const p = T.tile(m.x, m.y), b = T.mb(m.type), near = (q) => gates.some(([x, y]) => Math.hypot(x - q.x, y - q.y) < 1.5);
        out.push({ k: m.type, ok: p.y < W && near(p), mb: !!b && b.y < W, p: [Math.round(p.x), Math.round(p.y)] }); }
      return out; });
    assert.ok(r.length >= 8, 'monsters under the world: ' + r.map((o) => o.k).join(','));
    for (const o of r) { assert.ok(o.ok, o.k + ' points at ' + o.p); assert.ok(o.mb, o.k + ' from the Bestiary is on the surface'); }
    assert.ok(r.some((o) => o.k === 'cgob'), 'the cave goblin is among them');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

// owner 2026-10-22: "riding on the roads makes you faster than on the grass"
test('a road is faster than grass: 30% on a horse, 10% on foot', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, T = window.__GTRK, TS = T.TS, P = G.P, S = G.S, x0 = P.x, y0 = P.y;
      const find = (v) => { for (let d = 0; d < 80; d++) for (let dx = -d; dx <= d; dx++) for (const dy of [-d, d]) { const tx = (x0 / TS | 0) + dx, ty = (y0 / TS | 0) + dy; if (T.at(tx, ty) === v) return [tx, ty]; } return null; };
      const pa = find(2), gr = find(0), at = (p) => { P.x = p[0] * TS + 8; P.y = p[1] * TS + 10; };
      S.mounts = { rhorse: { hp: 100 } }; S.mount = 'rhorse';
      at(pa); const foot = T.road(); P.ride = 1; const ride = T.road(); P.ride = 0; at(gr); const grass = T.road(); P.ride = 1; const rgrass = T.road(); P.ride = 0; P.x = x0; P.y = y0;
      return { foot, ride, grass, rgrass }; });
    assert.deepEqual(r, { foot: 1.1, ride: 1.3, grass: 1, rgrass: 1 });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
