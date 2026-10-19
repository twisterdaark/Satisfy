'use strict';
// SAT-ONLINE-042 (owner 2026-10-19): shared monsters look and fight the same on every screen. Two players online over the
// fake; the one with the earlier arrival hosts the monsters, the other follows its list. Frame by frame, every monster near
// both must stand in the same place with the same health, and show the same attack (the red telegraph) at the same time;
// a follower is hurt by the host's monsters only through the attacks it replays (dodgeable), never by just standing close.
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
// every monster within r of this player: position, health per mille, dead, attack state
const view = (g, r) => g.eval((R) => {
  const G = window.__G, out = {};
  for (const m of G.mons()) { if (!m || m.arena) continue; if (Math.hypot(m.x - G.P.x, m.y - G.P.y) > R) continue;
    const k = m.nk || (m.type + '@' + (m.sx | 0) + ',' + (m.sy | 0));
    out[k] = { x: m.x, y: m.y, hp: m.dead ? 0 : Math.round(1000 * m.hp / m.max), dead: !!m.dead, atk: m.st === 'tele' || m.st === 'dash' || (m.tele > 0) ? 1 : 0, led: !!m.led }; }
  return out;
}, r);

test('online: the same monsters, health and attacks on both screens; the follower is hurt only by replayed attacks', async () => {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE] });
  try {
    const a = await online(ctx, 'a', 'gMsA1', 'Ahmed');
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const b = await online(ctx, 'b', 'gMsB2', 'Bassem'); // arrives second: A hosts
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    const spot = { x: 90 * 16, y: 60 * 16 }; // the plains west of Winston
    await a.eval((s) => { const G = window.__G; G.P.x = s.x; G.P.y = s.y; G.P.inv = 1e9; }, spot);
    await b.eval((s) => { const G = window.__G; G.P.x = s.x + 30; G.P.y = s.y; G.S.lv = 25; G.S.st.sta += 400; G.P.hp = window.__G.maxHP(); }, spot); // sturdy: it should be hit, not killed
    await frames([a, b], 60);
    // the host's monsters around turn on whoever is nearest (A takes no damage; B does)
    await a.eval(() => { const G = window.__G; for (const m of G.mons()) if (!m.dead && Math.hypot(m.x - G.P.x, m.y - G.P.y) < 260) { m.agg = 1; m.eng = 4; } });
    assert.ok(await b.eval(() => window.__G.mons().some((m) => m.led)), 'B follows A\'s monsters');
    let pairs = 0, atkA = 0, atkB = 0, atkDiff = 0, hpDiff = 0, deadDiff = 0; const err = [];
    let hurtB = 0, hp0 = await b.eval(() => window.__G.P.hp);
    for (let s = 0; s < 50; s++) {
      // B swings at the nearest monster now and then, so there is a fight
      if (s % 8 === 7) {
        const p = await b.eval(() => { const G = window.__G; let best = null, bd = 1e9; for (const m of G.mons()) { if (m.dead) continue; const d = Math.hypot(m.x - G.P.x, m.y - G.P.y); if (d < bd) { bd = d; best = m; } } if (!best || bd > 160) return null; G.P.acd = 0; return G.toScreen(best.x, best.y - 8); });
        if (p) await b.page.mouse.click(p.x, p.y);
      }
      await frames([a, b], 5);
      const va = await view(a, 260), vb = await view(b, 260);
      for (const k in va) {
        const ma = va[k], mb = vb[k];
        if (!mb) continue;
        pairs++; err.push(Math.hypot(ma.x - mb.x, ma.y - mb.y));
        if (Math.abs(ma.hp - mb.hp) > 30) hpDiff++;
        if (ma.dead !== mb.dead) deadDiff++;
        atkA += ma.atk; atkB += mb.atk; if (ma.atk !== mb.atk) atkDiff++;
      }
      const hp = await b.eval(() => window.__G.P.hp); if (hp < hp0 - 0.5) hurtB++; hp0 = hp;
      await b.eval(() => { const G = window.__G; if (G.P.hp < G.maxHP() * .8) G.P.hp = G.maxHP(); });
      assert.notEqual(await b.eval(() => window.__G.mode), 'dead', 'B stays alive for the measure');
    }
    err.sort((x, y) => x - y);
    const med = err[err.length >> 1];
    assert.ok(pairs > 100, 'monsters near both: ' + pairs);
    assert.ok(med <= 8, 'position, median px: ' + med);
    assert.equal(deadDiff, 0, 'alive/dead');
    assert.ok(hpDiff <= pairs * 0.02, 'health: ' + hpDiff + '/' + pairs);
    assert.ok(atkA > 5, 'the host saw attacks: ' + atkA);
    assert.ok(atkB >= atkA * 0.7, 'the follower sees them too: ' + atkB + ' of ' + atkA);
    assert.ok(atkDiff <= Math.max(4, atkA * 0.25), 'at the same time: ' + atkDiff + ' mismatches');
    assert.ok(hurtB > 0, 'the follower is hit by the replayed attacks');
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
