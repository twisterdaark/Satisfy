'use strict';
// SAT-ONLINE-074 (Claude-B's map ×2, #13): the far north and far south monsters (m.far, their own spawn RNG, asleep while no
// player is within 900 px) are shared like the rest. Two players online over the fake stand in the Chaos Mountains and then
// on the far south coast: the follower's copies of the host's far monsters stand where the host's do, with the same health,
// none of them asleep on the host while the follower fights them, and every key fits the rules (negative rows included).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const frames = async (gs, n) => { for (let k = 0; k < n; k++) { for (const g of gs) await g.step(2); await gs[0].page.waitForTimeout(12); } };
async function online(ctx, k, uid, name) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  for (let i = 0; i < 80 && !(await g.eval(() => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE')); i++) { await g.step(3); await g.page.waitForTimeout(30); }
  return g;
}
// far monsters within r of this player: position, health per mille, dead
const view = (g, r) => g.eval((R) => {
  const G = window.__G, out = {};
  for (const m of G.mons()) { if (!m || !m.far) continue; if (Math.hypot(m.x - G.P.x, m.y - G.P.y) > R) continue;
    const k = m.nk || (m.type + '@' + (m.sx | 0) + ',' + (m.sy | 0));
    out[k] = { x: m.x, y: m.y, hp: m.dead ? 0 : Math.round(1000 * m.hp / m.max), dead: !!m.dead, led: !!m.led }; }
  return out;
}, r);
// a far monster's spawn on open ground, in the north (above the old map) or the south, with the most far neighbours around
const farSpot = (g, north) => g.eval((n) => {
  const G = window.__G, W = G.world(), TS = 16, out = W.outdoorH ? W.outdoorH * TS : 1e9;
  const fs = G.mons().filter((m) => m.far && !m.dead && m.sy < out && !/^sanju|hydra/.test(m.type) && (n ? m.sy < 0 : m.sy > 0));
  let best = null, bn = -1;
  for (const m of fs) { const k = fs.filter((o) => Math.hypot(o.sx - m.sx, o.sy - m.sy) < 220).length; if (k > bn) { bn = k; best = m; } }
  return { x: best.sx, y: best.sy, type: best.type, n: bn };
}, north);

for (const north of [true, false]) {
  test('online: far ' + (north ? 'north' : 'south') + ' monsters are the same on both screens and awake while the follower fights them', async () => {
    const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock()] });
    try {
      const a = await online(ctx, 'a', 'gFmA1', 'Ahmed');
      await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
      const b = await online(ctx, 'b', 'gFmB2', 'Bassem'); // arrives second: A hosts
      await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
      const spot = await farSpot(a, north);
      if (north) assert.ok(spot.y < 0, 'the Chaos Mountains are above the old map: ' + JSON.stringify(spot));
      // both strong enough to stand among Lv 200+ monsters for the measure
      for (const [g, dx] of [[a, -40], [b, -10]]) {
        await g.eval(([s, d]) => { const G = window.__G; G.P.x = s.x + d; G.P.y = s.y; G.P.inv = 1e9; G.S.lv = 400; G.S.st.sta += 4000; G.S.st.str += 4000; G.P.hp = G.maxHP(); }, [spot, dx]);
      }
      await frames([a, b], 60);
      const near = await a.eval(() => { const G = window.__G; let n = 0; for (const m of G.mons()) if (m.far && !m.dead && Math.hypot(m.x - G.P.x, m.y - G.P.y) < 300) { m.agg = 1; m.eng = 4; n++; } return n; });
      assert.ok(near > 0, 'far monsters around the spot');
      assert.ok(await b.eval(() => window.__G.mons().some((m) => m.far && m.led)), 'B follows A\'s far monsters');
      let pairs = 0, hpDiff = 0, deadDiff = 0, moved = 0; const err = [], first = await view(a, 300);
      for (let s = 0; s < 40; s++) {
        if (s % 8 === 7) { // B swings at the nearest far monster now and then
          const p = await b.eval(() => { const G = window.__G; let best = null, bd = 1e9; for (const m of G.mons()) { if (m.dead || !m.far) continue; const d = Math.hypot(m.x - G.P.x, m.y - G.P.y); if (d < bd) { bd = d; best = m; } } if (!best || bd > 160) return null; G.P.acd = 0; return G.toScreen(best.x, best.y - 8); });
          if (p) await b.page.mouse.click(p.x, p.y);
        }
        await frames([a, b], 5);
        const va = await view(a, 300), vb = await view(b, 300);
        for (const k in va) {
          const ma = va[k], mb = vb[k];
          if (!mb) continue;
          pairs++; err.push(Math.hypot(ma.x - mb.x, ma.y - mb.y));
          if (Math.abs(ma.hp - mb.hp) > 30) hpDiff++;
          if (ma.dead !== mb.dead) deadDiff++;
        }
        for (const g of [a, b]) await g.eval(() => { const G = window.__G; if (G.P.hp < G.maxHP() * .8) G.P.hp = G.maxHP(); });
      }
      const last = await view(a, 400);
      for (const k in first) if (last[k] && Math.hypot(first[k].x - last[k].x, first[k].y - last[k].y) > 4) moved++;
      err.sort((x, y) => x - y);
      const med = err[err.length >> 1];
      assert.ok(pairs > 40, 'far monsters near both: ' + pairs);
      assert.ok(med <= 8, 'position, median px: ' + med);
      assert.equal(deadDiff, 0, 'alive/dead');
      assert.ok(hpDiff <= pairs * 0.02, 'health: ' + hpDiff + '/' + pairs);
      assert.ok(moved > 0, 'the host\'s far monsters are awake (they moved)');
      // what the host wrote passed the rules: keys with negative rows, values in size
      const keys = await a.eval(() => { const out = []; for (const [p, v] of window.__fakeRTDB.data) if (/^mobs\//.test(p) && v && v.m) out.push(...Object.keys(v.m)); return out; });
      assert.ok(keys.length > 0, 'the host published its list');
      if (north) assert.ok(keys.some((k) => /,-\d+$/.test(k)), 'a key on a negative row: ' + keys.slice(0, 3));
      for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
      for (const g of [a, b]) assert.deepEqual(g.errors, []);
    } finally { await ctx.close(); }
  });
}
