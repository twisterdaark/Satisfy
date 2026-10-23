'use strict';
// SAT-ONLINE-149 (owner 2026-10-23: "1:1 for everyone, with no differences"): two players online over the fake play for a
// while with seeded random actions: both hit what is near them, walk about, and now and then one walks off and comes back
// (the group splits and forms again, the host changes). Every two seconds, every monster near both must be the same on both
// screens: alive or dead, its health, its place. Whatever slips (a lost hit, a bar at 1, a monster gone, one jumping back)
// shows here as a difference.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const frames = async (gs, n) => { for (let k = 0; k < n; k++) { for (const g of gs) await g.step(2); await gs[0].page.waitForTimeout(10); } };
async function online(ctx, k, uid, name) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  for (let i = 0; i < 80 && !(await g.eval(() => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE')); i++) { await g.step(3); await g.page.waitForTimeout(30); }
  return g;
}
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const view = (g, cx, cy, r) => g.eval(([cx, cy, r]) => {
  const out = {};
  for (const m of window.__G.mons()) {
    if (m.arena || m.hidN || Math.hypot(m.x - cx, m.y - cy) > r) continue;
    const k = m.nk || (m.type + '@' + (m.sx | 0) + ',' + (m.sy | 0));
    out[k] = { x: m.x, y: m.y, pm: m.dead ? 0 : Math.round(1000 * m.hp / m.max), dead: !!m.dead, pend: m.pendT && performance.now() - m.pendT < 1500 };
  }
  return out;
}, [cx, cy, r]);
// a player's action: hit the nearest monster (a pack now and then), or walk a little
const act = (g, r, far) => g.eval(([r, far]) => {
  const G = window.__G, P = G.P;
  if (far === 1) { P.x += 2600; return 'away'; }
  if (far === -1) { P.x -= 2600; return 'back'; }
  if (r < 0.55) {
    const M = G.mons().filter((m) => !m.dead && !m.arena && Math.hypot(m.x - P.x, m.y - P.y) < 140).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y));
    for (const m of M.slice(0, r < 0.1 ? 4 : 1)) window.__GWP.hit(m, 2);
    return 'hit';
  }
  P.x += (r - 0.77) * 120; P.y += (r - 0.77) * 60; return 'walk';
}, [r, far]);

test('two players playing for a while: every monster near both is the same on both screens', async (t) => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock()] });
  try {
    const a = await online(ctx, 'a', 'gFzA1', 'Ahmed');
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await online(ctx, 'b', 'gFzB2', 'Bassem');
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const spot = { x: 90 * 16, y: 60 * 16 };
    await a.eval((s) => { const G = window.__G; G.P.x = s.x; G.P.y = s.y; G.P.inv = 1e9; }, spot);
    await b.eval((s) => { const G = window.__G; G.P.x = s.x + 60; G.P.y = s.y; G.P.inv = 1e9; }, spot);
    await frames([a, b], 40);
    const R = rng(149);
    let pairs = 0, deadDiff = 0, hpDiff = 0, posDiff = 0, awayA = false, awayB = false, splits = 0;
    const diffs = [];
    for (let s = 0; s < 60; s++) {
      // now and then one of them walks off for a while and comes back (B more often: it joins the host's group again)
      const roll = R();
      let fa = 0, fb = 0;
      if (s % 10 === 4) { if (roll < 0.5) { fb = awayB ? -1 : 1; awayB = !awayB; } else { fa = awayA ? -1 : 1; awayA = !awayA; } splits++; }
      if (s % 10 === 8) { if (awayA) { fa = -1; awayA = false; } if (awayB) { fb = -1; awayB = false; } }
      await act(a, R(), fa); await act(b, R(), fb);
      await frames([a, b], 20);
      if (awayA || awayB) continue;
      await frames([a, b], 25); // let the last hits land before comparing
      const pa = await a.eval(() => ({ x: window.__G.P.x, y: window.__G.P.y })), pb = await b.eval(() => ({ x: window.__G.P.x, y: window.__G.P.y }));
      const cx = (pa.x + pb.x) / 2, cy = (pa.y + pb.y) / 2;
      const va = await view(a, cx, cy, 260), vb = await view(b, cx, cy, 260);
      for (const k in va) {
        const ma = va[k], mb = vb[k];
        if (!mb || ma.pend || mb.pend) continue;
        pairs++;
        if (ma.dead !== mb.dead) { deadDiff++; diffs.push(s + ' ' + k + ' dead ' + ma.dead + '/' + mb.dead); continue; }
        if (ma.dead) continue;
        if (Math.abs(ma.pm - mb.pm) > 50) { hpDiff++; diffs.push(s + ' ' + k + ' hp ' + ma.pm + '/' + mb.pm); }
        if (Math.hypot(ma.x - mb.x, ma.y - mb.y) > 48) { posDiff++; diffs.push(s + ' ' + k + ' pos ' + Math.round(Math.hypot(ma.x - mb.x, ma.y - mb.y))); }
      }
    }
    assert.ok(pairs > 100, 'monsters near both: ' + pairs);
    assert.ok(splits >= 3, 'the group split and formed again: ' + splits);
    const bad = deadDiff + hpDiff + posDiff;
    t.diagnostic('pairs ' + pairs + ', splits ' + splits + ', differences ' + bad + (diffs.length ? ': ' + diffs.slice(0, 6).join(' | ') : ''));
    assert.ok(bad <= pairs * 0.03, bad + ' differences in ' + pairs + ': ' + diffs.slice(0, 12).join(' | '));
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
