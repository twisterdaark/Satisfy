'use strict';
// SAT-ONLINE-031 (owner feedback #8): one shared world of monsters. The zone's host leads them; the other player's copies
// follow (position, health, death). A follower's hit goes to the host; the kill pays the one who made it, once.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(games, fn, arg, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    let ok = true;
    for (const g of games) if (!(await g.eval(fn, arg))) { ok = false; break; }
    if (ok) return;
    if (Date.now() > end) throw new Error('timed out waiting for ' + fn);
    for (const g of games) await g.step(6);
    await games[0].page.waitForTimeout(30);
  }
}
const mobs = (g) => g.eval(() => Satisfy.local.net().mobs);

test('one host leads the zone\'s monsters; the other follows them, and a follower\'s kill pays only the follower', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    // both next to the same ordinary monster in the open (the nearest one to A's start, out of town)
    const spot = await a.eval(() => {
      const G = window.__G, ok = (m) => !m.dead && !m.tmp && !m.evt && m.sy < 160 * 16 && m.sy > 0;
      const cand = G.mons().filter(ok).filter((m) => Math.hypot(m.x - 90 * 16, m.y - 60 * 16) < 2000);
      cand.sort((p, q) => Math.hypot(p.x - 90 * 16, p.y - 60 * 16) - Math.hypot(q.x - 90 * 16, q.y - 60 * 16));
      const m = cand[0];
      return m ? { x: Math.round(m.x), y: Math.round(m.y), type: m.type, sx: m.sx, sy: m.sy } : null;
    });
    assert.ok(spot, 'a monster to share');
    // (both untouchable: a pack nearby would otherwise kill a fresh character before the test is done)
    for (const [g, dx] of [[a, -40], [b, 40]]) await g.eval(([s, d]) => { const G = window.__G; G.P.x = s.x + d; G.P.y = s.y; G.P.inv = 1e9; }, [spot, dx]);
    await settle(a, b);
    await until([a, b], () => { const m = Satisfy.local.net().mobs; return !!m && !!m.host; });
    const ma = await mobs(a), mb = await mobs(b);
    assert.equal(ma.host, mb.host, 'both agree on the host');
    const [host, fol] = ma.host === (await a.eval(() => Satisfy.local.net().uid)) ? [a, b] : [b, a];
    await until([fol], () => Satisfy.local.net().mobs.led > 0);

    // the host's monster stands still with 1 HP; the follower's copy is at the same place
    const key = spot.type + '@' + (spot.sx | 0) + ',' + (spot.sy | 0);
    await host.eval((k) => { const m = window.__G.mons().find((x) => x.type + '@' + (x.sx | 0) + ',' + (x.sy | 0) === k); m.stun = 999; m.hp = 1; m.dead = false; }, key);
    await settle(a, b); await settle(a, b);
    const at = (g) => g.eval((k) => { const m = window.__G.mons().find((x) => x.type + '@' + (x.sx | 0) + ',' + (x.sy | 0) === k); return m && { x: m.x, y: m.y, hp: m.hp, max: m.max, dead: m.dead, led: !!m.led }; }, key);
    const hm = await at(host), fm = await at(fol);
    assert.ok(fm.led, 'the follower\'s copy is led by the host');
    assert.ok(Math.abs(hm.x - fm.x) < 3 && Math.abs(hm.y - fm.y) < 3, JSON.stringify({ hm, fm }));
    assert.ok(fm.hp <= Math.ceil(fm.max / 500), 'the host\'s health (sent in per mille): ' + JSON.stringify(fm));

    // the follower swings at it: the hit goes to the host, the monster dies on both screens, the follower is paid
    const kills = (g) => g.eval((t) => ((window.__G.S.kills || {})[t] || 0), spot.type);
    const [kh0, kf0] = [await kills(host), await kills(fol)];
    await fol.eval((m) => { const G = window.__G; G.P.x = m.x - 12; G.P.y = m.y; G.P.acd = 0; }, fm);
    await fol.step(2);
    const scr = await fol.eval((m) => window.__G.toScreen(m.x, m.y - 6), fm);
    await fol.page.mouse.click(scr.x, scr.y);
    await until([a, b], (k) => { const m = window.__G.mons().find((x) => x.type + '@' + (x.sx | 0) + ',' + (x.sy | 0) === k); return !!m && m.dead; }, key);
    await settle(a, b);
    assert.equal(await kills(fol), kf0 + 1, 'the follower got the kill');
    assert.equal(await kills(host), kh0, 'the host did not hit it: no reward');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
