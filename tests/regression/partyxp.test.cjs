'use strict';
// SAT-ONLINE-146 (plan U056, "shared PvE XP: a contribution radius and anti-AFK thresholds; no XP for an absent participant
// outside the encounter"). When a party member kills a monster, the others near it get a quarter of that monster's XP for
// their own level, if they are still near and have moved or fought in the last minute. Far away, idle, or out of the
// party: nothing. One kill is shared once.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(g, fn, ms = 8000, arg) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn, arg)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}
// total XP so far, whatever the level (a level-up resets S.xp)
const xpOf = (g) => g.eval(() => { const G = window.__G, S = G.S; return { lv: S.lv, xp: S.xp }; });
// a monster that isn't a boss, alive, with A and B on either side of it and nothing else around
async function arena(a, b, dxB = 30) {
  const m = await a.eval(() => {
    const G = window.__G, P = G.P, M = G.mons().filter((x) => !x.dead && !x.tmp && !(G.MT ? G.MT[x.type].boss : x.type === 'gchief') && x.type !== 'gchief');
    M.sort((p, q) => Math.hypot(p.x - P.x, p.y - P.y) - Math.hypot(q.x - P.x, q.y - P.y));
    const m = M[0]; window.__pm = m; P.x = m.x - 30; P.y = m.y; P.inv = 1e9;
    for (const o of G.mons()) if (o !== m && Math.hypot(o.x - m.x, o.y - m.y) < 500) { o.dead = true; o.rt = 1e9; }
    m.agg = 0; m.eng = 0;
    return { x: m.x, y: m.y, type: m.type };
  });
  await b.eval(([x, y]) => { const G = window.__G; G.P.x = x; G.P.y = y; G.P.inv = 1e9; for (const o of G.mons()) if (Math.hypot(o.x - x, o.y - y) < 500) { o.agg = 0; o.eng = 0; } }, [m.x + dxB, m.y]);
  // new ground gives XP for exploring (more at a high level): let that come first, so only the share is measured
  for (let i = 0; i < 6; i++) { const x = (await xpOf(b)).xp; await settle(a, b); await busy(b); await settle(a, b); if ((await xpOf(b)).xp === x) break; }
  return m;
}
// B moves a little each step (someone playing, not away from the keyboard)
const busy = (b) => b.eval(() => { window.__G.P.x += 1; });
async function killAndWait(a, b, active = true) {
  await a.eval(() => { const m = window.__pm; m.myd = m.max; m.hp = 0; window.__GB2.kill(m); });
  for (let i = 0; i < 6; i++) { if (active) await busy(b); await settle(a, b); }
  await b.page.waitForTimeout(1500);
  for (let i = 0; i < 2; i++) { if (active) await busy(b); await settle(a, b); }
}

test('party XP: a quarter to a member near the kill and playing; nothing far away, idle or out of the party; once', async () => {
  const ctx = await H.newContext();
  try {
    const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
    const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    await a.page.keyboard.press('KeyP');
    await settle(a, b);
    await until(b, () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY');
    await settle(a, b);
    for (const g of [a, b]) await until(g, () => ((Satisfy.local.net().party || {}).members || []).length === 2);
    for (const g of [a, b]) await g.eval(() => { const S = window.__G.S; S.lv = 40; S.xp = 0; });

    // near and playing: a quarter of what the kill gave A (both level 40, no bonuses on new characters)
    await arena(a, b);
    await settle(a, b); await busy(b); await settle(a, b);
    const a0 = await xpOf(a), b0 = await xpOf(b);
    await killAndWait(a, b);
    const a1 = await xpOf(a), b1 = await xpOf(b);
    const ga = a1.xp - a0.xp, gb = b1.xp - b0.xp;
    assert.equal(a1.lv, a0.lv); assert.equal(b1.lv, b0.lv);
    assert.ok(ga > 0, 'A got the kill: ' + ga);
    assert.ok(gb > 0 && Math.abs(gb - ga / 4) <= 1, 'B got a quarter: ' + gb + ' of ' + ga);

    // boosting slower (owner 2026-10-23): far above you it pays less, a kill you barely hit pays the share, and at most 3% a kill
    const bo = await b.eval(() => { const X = window.__GPXP, S = window.__G.S, need = window.__G.xpNeed ? window.__G.xpNeed() : null;
      return { g: [10, 20, 40, 60, 100].map((d) => +X.gap(d).toFixed(2)), hit: X.kf({ lv: S.lv + 5, max: 100, myd: 50 }), low: X.kf({ lv: S.lv + 5, max: 100, myd: 5 }), far: X.kf({ lv: S.lv + 60, max: 100, myd: 50 }), cap: X.cap(1e9, S.lv + 30), near: X.cap(1e9, S.lv + 10) }; });
    assert.deepEqual(bo.g, [1.3, 1.3, 0.75, 0.2, 0.2]);
    assert.ok(Math.abs(bo.hit - 1.15) < 1e-9 && Math.abs(bo.low - 1.15 / 4) < 1e-9 && Math.abs(bo.far - 0.2) < 1e-9, JSON.stringify(bo));
    assert.ok(bo.cap < 1e9 && bo.cap > 0, 'capped: ' + bo.cap); assert.equal(bo.near, 1e9);

    // far away (out of the radius): nothing
    await arena(a, b, 900);
    await settle(a, b);
    let x0 = (await xpOf(b)).xp;
    await killAndWait(a, b);
    assert.equal((await xpOf(b)).xp, x0, 'far away: nothing');

    // near but idle for a minute: nothing
    await arena(a, b);
    await settle(a, b);
    await b.eval(() => window.__GPXP.idle());
    x0 = (await xpOf(b)).xp;
    await killAndWait(a, b, false);
    assert.equal((await xpOf(b)).xp, x0, 'idle: nothing');

    // the same kill told twice: shared once (the second message is a new one, sent straight on the channel)
    await arena(a, b);
    await settle(a, b); await busy(b); await settle(a, b);
    const key = await a.eval(() => { const m = window.__pm; return m.nk || (m.type + '@' + (m.sx | 0) + ',' + (m.sy | 0)); });
    x0 = (await xpOf(b)).xp;
    await killAndWait(a, b);
    const x1 = (await xpOf(b)).xp;
    assert.ok(x1 > x0, 'shared');
    const ub = await b.eval(() => Satisfy.local.net().uid);
    await a.eval(([u, k]) => { const me = Satisfy.local.net(), ch = new BroadcastChannel('satisfy-net-v1'); ch.postMessage(Satisfy.net.envelope('raid.state', { to: u, raid: 'x|' + k + '|40', k: 0 }, { sessionId: me.sid, seq: 1e9 })); ch.close(); }, [ub, key]);
    for (let i = 0; i < 4; i++) { await busy(b); await settle(a, b); }
    await b.page.waitForTimeout(1500); await settle(a, b);
    assert.equal((await xpOf(b)).xp, x1, 'once');

    // out of the party: nothing
    await b.eval(() => document.querySelector('#partyW [data-act="pLeave"]').click());
    await settle(a, b); await settle(a, b);
    await arena(a, b);
    await settle(a, b); await busy(b); await settle(a, b);
    x0 = (await xpOf(b)).xp;
    await killAndWait(a, b);
    assert.equal((await xpOf(b)).xp, x0, 'not in the party: nothing');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
