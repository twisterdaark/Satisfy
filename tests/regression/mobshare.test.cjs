'use strict';
// SAT-ONLINE-149 (owner 2026-10-23: "a monster's health can sit at 1 and you can't kill it while people are with you, then
// suddenly it is back at about 20% and you kill it again; the golems disappear when people come near you; I want it 1:1 for
// everyone"). Two players online over the fake; A arrived first and hosts the monsters, B follows. Each case is something a
// player saw differ between the two screens:
//   - a monster with more health on the host (an elite, a boss scaled for the group, an invasion's monster) killed by B: the
//     bar falls the same on both screens and the kill is a kill, not 1 HP and then back up;
//   - many hits at once (a skill on a pack, over and over): every one counts on the host;
//   - B was fighting before A came near: the monster stays where it was, with the health it had, on both screens;
//   - a monster only B has (an event wave A missed): it stays on B's screen and A sees it too;
//   - B's share of a kill when the host's "it died" message is lost: B still gets it, once;
//   - the host leaves in the middle of a fight: B goes on with the same monster as it was;
//   - the world's NPC allies (a town's defenders, the war's allies), run on every screen, hit once (the host's), while your
//     own (a companion, Regas's knights) hit as you do;
//   - a monster draining B (v2.04's signature moves) heals on the host, so both bars rise the same; a shield (ward) is the
//     host's; a boss's wind-up shows on every screen.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const A_UID = 'gMhA1', B_UID = 'gMhB2';
const frames = async (gs, n) => { for (let k = 0; k < n; k++) { for (const g of gs) await g.step(2); await gs[0].page.waitForTimeout(12); } };
async function online(ctx, k, uid, name) {
  const g = await H.openGame({ ctx, query: '?net=online&slot=' + k });
  await g.eval(([u, n]) => { window.__fakeRTDB.data.set('accountIds/' + u, n); window.__fakeRTDB.nextName = n; window.__fakeRTDB.nextUid = u; document.getElementById('onlineBtn').click(); }, [uid, name]);
  for (let i = 0; i < 80 && !(await g.eval(() => !!Satisfy.local.net() && Satisfy.local.net().state === 'ONLINE')); i++) { await g.step(3); await g.page.waitForTimeout(30); }
  return g;
}
const SPOT = { x: 90 * 16, y: 60 * 16 }; // the plains west of Winston
// A first (it hosts), then B; both can't be hurt; B at dx from A
async function pair(dx = 30) {
  const ctx = await H.newContext({ scripts: [H.FAKE_FIREBASE, H.fixedClock()] });
  const a = await online(ctx, 'a', A_UID, 'Ahmed');
  await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
  const b = await online(ctx, 'b', B_UID, 'Bassem');
  await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
  await a.eval((s) => { const G = window.__G; G.P.x = s.x; G.P.y = s.y; G.P.inv = 1e9; }, SPOT);
  await b.eval(([s, d]) => { const G = window.__G; G.P.x = s.x + d; G.P.y = s.y; G.P.inv = 1e9; }, [SPOT, dx]);
  await frames([a, b], 40);
  return { ctx, a, b };
}
// in-page helpers: a monster by its shared key; its health per mille (0 dead)
const KEY = 'const key = (m) => m.nk || (m.type + "@" + (m.sx | 0) + "," + (m.sy | 0)), by = (k) => window.__G.mons().find((m) => key(m) === k), pm = (m) => !m || m.dead ? 0 : Math.round(1000 * m.hp / m.max);';
const on = (g, fn, arg) => g.eval(new Function('arg', KEY + ' return (' + fn + ')(arg);'), arg);
// the nearest living monsters to this player (keys), nothing else close by
const nearest = (g, n, r = 260) => on(g, ([n, r]) => {
  const G = window.__G, P = G.P;
  return G.mons().filter((m) => !m.dead && !m.arena && m.max < 1e6 && Math.hypot(m.x - P.x, m.y - P.y) < r).sort((p, q) => Math.hypot(p.x - P.x, p.y - P.y) - Math.hypot(q.x - P.x, q.y - P.y)).slice(0, n).map(key);
}, [n, r]);
const state = (g, k) => on(g, (k) => { const m = by(k); return m ? { x: m.x, y: m.y, pm: pm(m), dead: !!m.dead, led: !!m.led, hid: !!m.hidN, max: m.max } : null; }, k);
const kills = (g, type) => g.eval((t) => window.__G.S.kills[t] || 0, type);
const hostOf = (g) => g.eval(() => window.__GM.host);

test('more health on the host (an elite, a boss scaled for the group): B\'s hits fall the same on both bars and kill it, no 1 HP and back up', async () => {
  const { ctx, a, b } = await pair();
  try {
    assert.equal(await hostOf(b), A_UID, 'A hosts');
    const [k] = await nearest(b, 1);
    assert.ok(k, 'a monster near B');
    const type = k.split('@')[0], k0 = await kills(b, type);
    // only the host's copy has three times the health, as an elite or a group-scaled boss has
    await on(a, (k) => { const m = by(k); m.max *= 3; m.hp = m.max; m.agg = 1; m.eng = 4; }, k);
    await frames([a, b], 30);
    let stuck = 0, n = 0, worst = 0;
    for (let i = 0; i < 120; i++) {
      const sb = await state(b, k), sa = await state(a, k);
      if (!sa || sa.dead || !sb || sb.dead) break;
      await on(b, (k) => { const m = by(k); m.x = window.__G.P.x + 20; window.__GWP.hit(m, 6); }, k);
      await frames([a, b], 6);
      const xa = await state(a, k), xb = await state(b, k);
      if (xa && xb && !xa.dead && !xb.dead) { n++; worst = Math.max(worst, Math.abs(xa.pm - xb.pm)); if (xb.pm <= 2 && xa.pm > 100) stuck++; }
    }
    await frames([a, b], 120); // 2 s with no hits: whatever B saw must be what is there
    const fa = await state(a, k), fb = await state(b, k);
    assert.ok(fa.dead, 'dead on the host');
    assert.ok(fb.dead, 'dead on B');
    assert.ok(n > 3, 'a fight: ' + n);
    assert.ok(stuck <= 1, 'B never sat at 1 HP while the host had more than 10%: ' + stuck + ' times');
    assert.ok(worst <= 120, 'the two bars together: worst gap ' + worst + '‰');
    assert.equal(await kills(b, type), k0 + 1, 'B has the kill, once');
    for (const g of [a, b]) assert.deepEqual(await g.eval(() => window.__fakeRTDB.rejected), []);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('many hits at once (a skill on a pack, again and again): every one of B\'s hits counts on the host', async () => {
  const { ctx, a, b } = await pair();
  try {
    const ks = await nearest(b, 8, 400);
    assert.ok(ks.length >= 4, 'a pack: ' + ks.length);
    for (const g of [a, b]) await on(g, (ks) => { for (const k of ks) { const m = by(k); if (m) { m.max = m.hp = 1e9; m.agg = 0; m.eng = 0; } } }, ks);
    await frames([a, b], 30);
    assert.ok((await Promise.all(ks.map((k) => state(b, k)))).every((s) => s && s.led), 'B follows them');
    let dealt = 0;
    for (let r = 0; r < 10; r++) {
      dealt += await on(b, (ks) => { let d = 0; for (const k of ks) { const m = by(k); const h = m.hp; window.__GWP.hit(m, 1); d += h - m.hp; } return d; }, ks);
      await frames([a, b], 2);
    }
    await frames([a, b], 150);
    const got = await on(a, (ks) => ks.reduce((s, k) => s + (1e9 - by(k).hp), 0), ks);
    assert.ok(dealt > 0);
    assert.ok(Math.abs(got - dealt) <= dealt * 0.01, 'the host took ' + got + ' of the ' + dealt + ' B dealt (' + ks.length * 10 + ' hits in about a second)');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('B was fighting before A came near: the monster stays where it was with the health it had, on both screens', async () => {
  const { ctx, a, b } = await pair(2600); // far apart: each on its own
  try {
    assert.equal(await hostOf(b), null, 'B alone');
    const [k] = await nearest(b, 1, 300);
    assert.ok(k, 'a monster near B');
    const type = k.split('@')[0], k0 = await kills(b, type);
    for (let i = 0; i < 60 && (await state(b, k)).pm > 600; i++) { await on(b, (k) => { const m = by(k); window.__GWP.hit(m, 0.6); m.agg = 1; m.eng = 4; }, k); await frames([b], 4); }
    const s0 = await state(b, k);
    assert.ok(s0.pm <= 600 && s0.pm > 100, 'B has it at ' + s0.pm + '‰');
    // A walks up
    await a.eval(([x, y]) => { const P = window.__G.P; P.x = x + 140; P.y = y; }, [s0.x, s0.y]);
    let prev = s0, jump = 0, top = s0.pm, gone = 0;
    for (let i = 0; i < 40; i++) {
      await frames([a, b], 3);
      const s = await state(b, k);
      if (!s || s.dead || s.hid) { gone++; continue; }
      jump = Math.max(jump, Math.hypot(s.x - prev.x, s.y - prev.y)); top = Math.max(top, s.pm); prev = s;
    }
    assert.equal(await hostOf(b), A_UID, 'A hosts now');
    assert.equal(gone, 0, 'it never vanished on B');
    assert.ok(jump <= 50, 'it never jumped on B: ' + Math.round(jump) + ' px');
    assert.ok(top <= s0.pm + 30, 'its health never came back on B: ' + top + '‰ (was ' + s0.pm + '‰)');
    const sa = await state(a, k), sb = await state(b, k);
    assert.ok(sa && !sa.dead, 'alive on A');
    assert.ok(Math.abs(sa.pm - sb.pm) <= 60, 'the same health on both: ' + sa.pm + ' / ' + sb.pm);
    assert.ok(Math.hypot(sa.x - sb.x, sa.y - sb.y) <= 60, 'in the same place on both');
    // B finishes it: dead on both, B's kill
    for (let i = 0; i < 80 && !(await state(b, k)).dead; i++) { await on(b, (k) => { const m = by(k); if (m && !m.dead) window.__GWP.hit(m, 1); }, k); await frames([a, b], 4); }
    await frames([a, b], 60);
    assert.ok((await state(a, k)).dead && (await state(b, k)).dead, 'dead on both');
    assert.equal(await kills(b, type), k0 + 1);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('a monster only B has (an event wave A missed): it stays on B\'s screen, A sees it too, and its death is seen by both', async () => {
  const { ctx, a, b } = await pair(2600);
  try {
    const k = await on(b, () => { const G = window.__G, m = G.spawnMon('wolf', G.P.x + 50, G.P.y); m.ek = 1; m.evt = 1; m.max = m.hp = 300; m.agg = 1; m.eng = 4; return key(m); });
    assert.equal(await state(a, k), null, 'A has no such monster');
    await frames([b], 20);
    const s0 = await state(b, k);
    await a.eval(([x, y]) => { const P = window.__G.P; P.x = x + 140; P.y = y; }, [s0.x, s0.y]);
    let gone = 0;
    for (let i = 0; i < 40; i++) { await frames([a, b], 3); const s = await state(b, k); if (!s || s.dead || s.hid) gone++; }
    assert.equal(await hostOf(b), A_UID);
    assert.equal(gone, 0, 'it stayed on B');
    const sa = await state(a, k), sb = await state(b, k);
    assert.ok(sa && !sa.dead, 'A sees it');
    assert.ok(Math.hypot(sa.x - sb.x, sa.y - sb.y) <= 60, 'in the same place');
    const hp0 = (await state(a, k)).pm;
    for (let i = 0; i < 80 && !(await state(b, k)).dead; i++) { await on(b, (k) => { const m = by(k); if (m && !m.dead) window.__GWP.hit(m, 8); }, k); await frames([a, b], 4); }
    await frames([a, b], 60);
    assert.ok((await state(b, k)).dead, 'dead on B: ' + JSON.stringify([hp0, await state(a, k), await state(b, k)]));
    const da = await state(a, k);
    assert.ok(!da || da.dead, 'dead on A');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('the host\'s "it died" message is lost: B, who hit it, still gets its share, and only once', async () => {
  const { ctx, a, b } = await pair();
  try {
    const [k] = await nearest(b, 1);
    const type = k.split('@')[0];
    for (const [drop, why] of [[true, 'message lost'], [false, 'message and list both arrive']]) {
      const [kk] = drop ? [k] : await nearest(b, 1);
      const ty = kk.split('@')[0], k0 = await kills(b, ty), xp0 = await b.eval(() => window.__G.S.xp + window.__G.S.lv * 1e9);
      await b.eval((d) => { window.__fakeRTDB.dropIn = d ? '^inbox/' : null; }, drop);
      await on(a, (k) => { const m = by(k); m.max = m.hp = 1e6; }, kk);
      await frames([a, b], 20);
      await on(b, (k) => { const m = by(k); window.__GWP.hit(m, 1); }, kk);
      await frames([a, b], 20);
      await on(a, (k) => { const m = by(k); m.hp = 0; window.__GB2.kill(m); }, kk);
      await frames([a, b], 60);
      assert.ok((await state(b, kk)).dead, why + ': dead on B');
      assert.equal(await kills(b, ty), k0 + 1, why + ': B has the kill once');
      assert.ok((await b.eval(() => window.__G.S.xp + window.__G.S.lv * 1e9)) > xp0, why + ': and its XP');
      await b.eval(() => { window.__fakeRTDB.dropIn = null; });
    }
    assert.ok(type);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('the host leaves in the middle of a fight: B goes on with the same monster, where it was, with the health it had', async () => {
  const { ctx, a, b } = await pair();
  try {
    const [k] = await nearest(b, 1);
    await on(a, (k) => { const m = by(k); m.max = m.hp = 4000; m.hp = 2000; m.agg = 1; m.eng = 4; }, k);
    await frames([a, b], 30);
    const s0 = await state(b, k);
    assert.ok(Math.abs(s0.pm - 500) <= 20, 'B sees the host\'s half: ' + s0.pm);
    await on(b, (k) => { by(k).cd = 5; }, k);
    await a.close();
    let prev = s0, jump = 0, top = 0;
    // once B runs it on its own, its own moves (v2.04: a wolf's leap, a potion) are the game, not a jump: none here (Claude-B, #187)
    for (let i = 0; i < 40; i++) { await on(b, (k) => { const m = by(k); if (m) m.cd = Math.max(m.cd || 0, 5); }, k); await frames([b], 6); const s = await state(b, k); if (!s || s.dead) break; jump = Math.max(jump, Math.hypot(s.x - prev.x, s.y - prev.y)); top = Math.max(top, s.pm); prev = s; }
    assert.equal(await hostOf(b), null, 'B on its own');
    assert.ok(jump <= 50, 'no jump: ' + Math.round(jump));
    assert.ok(top <= 520, 'its health as it was: ' + top);
    assert.equal((await state(b, k)).max, 4000, "the host's full health kept");
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});

test("NPC allies every screen runs hit once, on the host; a player's own ally hits like the player", async () => {
  const { ctx, a, b } = await pair();
  try {
    const [k] = await nearest(b, 1);
    for (const g of [a, b]) await on(g, (k) => { const m = by(k); m.max = m.hp = 1e6; m.agg = 0; m.eng = 0; }, k);
    await frames([a, b], 30);
    assert.ok((await state(b, k)).led, 'B follows it');
    // on B: a town defender's blow (ally) is the host's to deal; B's copy keeps its health and nothing goes to the host
    const r = await on(b, (k) => { const m = by(k), h = m.hp; m.hp -= 500; const handed = window.__GM.hit(m, 500, 1); return [handed, m.hp === h]; }, k);
    assert.deepEqual(r, [true, true]);
    await frames([a, b], 60);
    assert.equal(await on(a, (k) => by(k).hp, k), 1e6, 'not dealt again on the host');
    // B's own ally (a companion, Regas's knights): handed over like B's own hit, and dealt on the host
    await on(b, (k) => { const m = by(k); m.hp -= 500; window.__GM.hit(m, 500); }, k);
    await frames([a, b], 60);
    assert.equal(await on(a, (k) => by(k).hp, k), 1e6 - 500, 'dealt once on the host');
    // on the host, an ally's blow is just dealt there
    assert.equal(await on(a, (k) => { const m = by(k); m.hp -= 300; return window.__GM.hit(m, 300, 1); }, k), false);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test("B's knockback moves the host's copy too, and B's copy doesn't spring back", async () => {
  const { ctx, a, b } = await pair();
  try {
    const [k] = await nearest(b, 1);
    for (const g of [a, b]) await on(g, (k) => { const m = by(k); m.max = m.hp = 1e6; m.agg = 0; m.eng = 0; }, k);
    await on(a, (k) => { by(k).stun = 30; }, k); // held still on the host: only the knockback moves it
    await frames([a, b], 40);
    const x0 = (await state(a, k)).x;
    for (let i = 0; i < 3; i++) { await on(b, (k) => window.__GHC.hit(by(k), { kx: 1, ky: 0 }), k); await frames([a, b], 8); }
    let back = 0, prev = (await state(b, k)).x;
    for (let i = 0; i < 20; i++) { await frames([a, b], 3); const x = (await state(b, k)).x; if (x < prev - 3) back++; prev = x; }
    const xa = (await state(a, k)).x, xb = (await state(b, k)).x;
    assert.ok(xa - x0 >= 12, 'pushed on the host: ' + (xa - x0).toFixed(1) + ' px');
    assert.ok(Math.abs(xa - xb) <= 10, 'the same place on both: ' + xa.toFixed(1) + ' / ' + xb.toFixed(1));
    assert.equal(back, 0, 'no spring back on B');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('the host goes away, the others fight on, the host comes back: the monster keeps the health they left it with', async () => {
  const { ctx, a, b } = await pair();
  try {
    const [k] = await nearest(b, 1);
    await on(a, (k) => { const m = by(k); m.max = 4000; m.hp = 2000; m.agg = 1; m.eng = 4; }, k);
    await frames([a, b], 30);
    assert.ok(Math.abs((await state(b, k)).pm - 500) <= 20, 'half, on both');
    // A walks far off (or died and respawned in town): B is on its own and takes it down to a quarter
    await a.eval(() => { window.__G.P.x += 2600; });
    await frames([a, b], 30);
    assert.equal(await hostOf(b), null, 'B alone');
    for (let i = 0; i < 80 && (await state(b, k)).pm > 250; i++) { await on(b, (k) => { const m = by(k); m.agg = 1; m.eng = 4; m.x = window.__G.P.x + 20; window.__GWP.hit(m, 3); }, k); await frames([b], 4); }
    const s1 = await state(b, k);
    assert.ok(s1.pm <= 250 && s1.pm > 0, 'B has it at ' + s1.pm + '‰');
    // A comes back: it was there first, so it hosts again, with its old copy at half
    await a.eval(([x, y]) => { const P = window.__G.P; P.x = x + 120; P.y = y; }, [s1.x, s1.y]);
    let top = 0;
    for (let i = 0; i < 40; i++) { await frames([a, b], 3); const s = await state(b, k); if (s && !s.dead) top = Math.max(top, s.pm); }
    assert.equal(await hostOf(b), A_UID, 'A hosts again');
    assert.ok(top <= s1.pm + 30, "B's monster never went back to A's old health: " + top + '‰ (was ' + s1.pm + '‰)');
    const sa = await state(a, k);
    assert.ok(Math.abs(sa.pm - s1.pm) <= 40, 'A has it as B left it: ' + sa.pm + '‰');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test('a monster draining B heals itself on the host, so both bars rise the same and B\'s doesn\'t jump', async () => {
  const { ctx, a, b } = await pair();
  try {
    const [k] = await nearest(b, 1);
    for (const g of [a, b]) await on(g, (k) => { const m = by(k); m.max = 1e6; m.hp = 5e5; m.agg = 0; m.eng = 0; }, k);
    await on(a, (k) => { by(k).stun = 30; }, k);
    await frames([a, b], 40);
    assert.deepEqual([(await state(a, k)).pm, (await state(b, k)).pm], [500, 500]);
    await on(b, (k) => window.__GM.mx({ k: 'arc', drain: 0.1 }, by(k)), k); // its blow on B drains a tenth of its health back
    let hi = 0;
    for (let i = 0; i < 30; i++) { await frames([a, b], 2); hi = Math.max(hi, (await state(b, k)).pm); }
    assert.equal((await state(a, k)).pm, 600, "healed on the host's copy");
    assert.equal((await state(b, k)).pm, 600, "and so on B's");
    assert.ok(hi <= 600, "B's bar never above the host's: " + hi);
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test("a shield (v2.04's ward) is the host's: B's copy has it while the host's has it, with the same share, and loses it with it", async () => {
  const { ctx, a, b } = await pair();
  try {
    const [k] = await nearest(b, 1);
    for (const g of [a, b]) await on(g, (k) => { const m = by(k); m.max = m.hp = 1e6; m.agg = 0; m.eng = 0; }, k);
    await on(a, (k) => { const m = by(k); m.stun = 30; m.wardT = window.__GANIM.t() / 1000 + 30; m.wardR = 0.45; }, k);
    await frames([a, b], 30);
    const w = (g) => on(g, (k) => { const m = by(k); return { on: m.wardT > window.__GANIM.t() / 1000, r: m.wardR }; }, k);
    assert.deepEqual(await w(b), { on: true, r: 0.45 }, 'shielded on B too');
    // a shield only B's copy got (its own replay picked another monster): not B's to keep
    const [k2] = (await nearest(b, 2)).filter((x) => x !== k);
    if (k2) { await on(b, (k) => { by(k).wardT = window.__GANIM.t() / 1000 + 30; }, k2); await frames([a, b], 20); assert.equal((await on(b, (k) => by(k).wardT > window.__GANIM.t() / 1000, k2)), false, "not shielded where the host's isn't"); }
    await on(a, (k) => { by(k).wardT = 0; }, k);
    await frames([a, b], 30);
    assert.equal((await w(b)).on, false, 'and loses it with the host');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});

test("a boss's wind-up before its blow shows on B's screen too, not only the host's", async () => {
  const { ctx, a, b } = await pair();
  try {
    const [k] = await nearest(b, 1);
    for (const g of [a, b]) await on(g, (k) => { const m = by(k); m.max = m.hp = 1e6; m.agg = 0; m.eng = 0; }, k);
    await on(a, (k) => { by(k).stun = 30; }, k);
    await frames([a, b], 30);
    await on(a, (k) => { const m = by(k); m.bw = 0.5; window.__GM.act(m); }, k); // as the boss AI winds up
    let seen = 0;
    for (let i = 0; i < 20 && !seen; i++) { await frames([a, b], 2); if (await on(b, (k) => by(k).bw > 0, k)) seen = 1; }
    assert.equal(seen, 1, 'B saw it wind up');
    for (const g of [a, b]) assert.deepEqual(g.errors, []);
  } finally { await ctx.close(); }
});
