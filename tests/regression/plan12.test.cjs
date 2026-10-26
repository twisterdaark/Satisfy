'use strict';
// Plan batch 12 (owner 2026-10-26 21:35: "keep making updates, don't stop"): U141 the marsh's chests (a mimic's tell, real
// chests with a needle trap); U176 the Vampire Lord's fight branches by night or day; U105 a merchant's supply orders and
// pre-orders.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the marsh chests: three real ones with a needle trap, and a mimic that bites when you reach for it', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, X = window.__GPB12, Y = window.__GPB11, o = {};
      const L = X.tchList(); o.n = L.length;
      o.inMarsh = L.every((c) => c.x >= 350 * 16 && c.x < 410 * 16 && c.y >= 102 * 16 && c.y < 119 * 16);
      o.apart = L.every((a, i) => L.every((b, j) => i === j || Math.hypot(a.x - b.x, a.y - b.y) >= 120));
      o.notMons = !L.some((c) => G.mons().includes(c));
      o.same = X.tchList() === L;
      // disarm the first: E inside the green
      const c0 = L[0]; P.x = c0.x + 10; P.y = c0.y + 4; S.gold = 0;
      X.tchOpen(c0); o.trap = !!X.TCT; X.setT0(Y.gTime() - 0.5 / 1.3); X.tchPress();
      o.gold = S.gold; o.cd = Math.round((S.tch[0] - Date.now()) / 60000);
      X.tchOpen(c0); o.empty = !X.TCT;
      // the second: E outside the green
      const c1 = L[1]; P.x = c1.x + 10; P.y = c1.y + 4; const g1 = S.gold;
      X.tchOpen(c1); X.setT0(Y.gTime() - 0.1 / 1.3); X.tchPress();
      o.needle = [S.gold === g1, P.dotT > Y.gTime(), P.dotC, Math.round((S.tch[1] - Date.now()) / 1000)];
      // a mimic: reaching for it wakes it
      const m = G.mons().find((x) => x.type === 'mimic' && !x.dead); m.dorm = 1; X.tchOpen(m); o.woke = m.dorm === 0 && m.agg === 1;
      return o;
    });
    assert.equal(r.n, 3); assert.equal(r.inMarsh, true); assert.equal(r.apart, true); assert.equal(r.notMons, true); assert.equal(r.same, true);
    assert.equal(r.trap, true, 'E starts the needle\'s sweep');
    assert.equal(r.gold, 100 + 1 * 4, 'disarmed and opened'); assert.ok(r.cd >= 19 && r.cd <= 20, 'refills in 20 min: ' + r.cd);
    assert.equal(r.empty, true, 'empty until then');
    assert.deepEqual(r.needle, [true, true, 'pois', 60], 'the needle poisons, the lock jams a minute');
    assert.equal(r.woke, true, 'a mimic wakes');
    // the tell: the lid cracks open part of each cycle, drawn without errors; on the minimap a dormant mimic is no monster
    await g.eval(() => { const G = window.__G, m = G.mons().find((x) => x.type === 'mimic' && !x.dead && x.dorm !== 0); if (m) { const P = G.P; P.x = m.x + 40; P.y = m.y; } });
    await g.step(60);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the Vampire Lord branches at his first roar: the night\'s way or the blood\'s, by the world\'s clock', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, P = G.P, X = window.__GPB12, Y = window.__GPB11, o = {};
      const bats = () => G.mons().filter((m) => m.type === 'vbat' && m.tmp && !m.dead).length;
      X.DNF.h = 23; const n = Y.newMon('vlord', P.x + 80, P.y); n.hp = Math.round(n.max * .6); let b0 = bats(); X.bossPhase(n, 1); o.night = [n.vlb, bats() - b0, X.p3Atk(n)];
      X.DNF.h = 12; const d = Y.newMon('vlord', P.x - 80, P.y); d.hp = Math.round(d.max * .6); b0 = bats(); X.bossPhase(d, 1); o.day = [d.vlb, bats() - b0, X.p3Atk(d)];
      const h0 = d.hp; X.p3Hurt(100, d); o.heal = d.hp - h0;
      const k = Y.newMon('vlord', P.x, P.y + 80); k.hp = Math.round(k.max * .6); const k0 = k.hp; X.p3Hurt(100, k); o.plain = k.hp - k0;
      // a second roar keeps the way he took
      X.DNF.h = 23; X.bossPhase(d, 2); o.kept = d.vlb;
      X.DNF.h = null; for (const m of [n, d, k]) m.dead = true;
      return o;
    });
    assert.equal(r.night[0], 'n'); assert.equal(r.night[2], 1, 'no shield by night');
    assert.equal(r.day[0], 'b'); assert.equal(r.day[2], .85, 'the blood shield');
    assert.ok(r.night[1] > r.day[1], 'twice the bats by night: ' + [r.night[1], r.day[1]]);
    assert.equal(r.plain, 200, 'a bite heals him twice its damage'); assert.equal(r.heal, 300, 'by the blood\'s way, half again');
    assert.equal(r.kept, 'b');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a merchant\'s contracts: a supply order paid on the spot, a pre-order picked up the next day, one of each a day', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GPB12, o = {};
      o.low = X.spcOpts('merchantR').length;
      S.lv = 100; S.gold = 100000;
      o.labels = X.spcOpts('merchantR').map((x) => x.l);
      const R = X.spcRoll('merchantR', 's'), R2 = X.spcRoll('merchantR', 's'); o.same = JSON.stringify(R) === JSON.stringify(R2);
      o.other = JSON.stringify(X.spcRoll('merchantRh', 's')) !== JSON.stringify(R) || JSON.stringify(X.spcRoll('merchantRo', 's')) !== JSON.stringify(R);
      // without the goods: refused
      S.mats[R.k] = 0; X.spcOpts('merchantR')[0].f(); o.refused = S.gold === 100000;
      S.mats[R.k] = R.n + 3; const g0 = S.gold; X.spcOpts('merchantR')[0].f(); o.supplied = [S.gold - g0 === R.g, S.mats[R.k]];
      o.after = X.spcOpts('merchantR').map((x) => x.l);
      // the pre-order
      const B = X.spcRoll('merchantR', 'b'), g1 = S.gold; X.spcOpts('merchantR')[0].f(); o.paid = g1 - S.gold === B.g; o.spo = S.spo.length;
      o.today = X.spcOpts('merchantR').length;
      S.spo[0].d -= 1; const m0 = S.mats[B.k] || 0; const get = X.spcOpts('merchantR'); o.get = get.map((x) => x.l); get[0].f(); o.got = (S.mats[B.k] || 0) - m0 === B.n; o.left = S.spo.length;
      S.spc.d -= 1; o.tomorrow = X.spcOpts('merchantR').length;
      return o;
    });
    assert.equal(r.low, 0, 'not below level 30');
    assert.match(r.labels[0], /^📜 Supply order: \d+ .+ for [\d,]+ gold$/); assert.match(r.labels[1], /^📜 Pre-order: \d+ .+ for [\d,]+ gold \(pick up from tomorrow\)$/);
    assert.equal(r.same, true, 'the day\'s goods are fixed'); assert.equal(r.other, true, 'and differ by merchant');
    assert.equal(r.refused, true);
    assert.deepEqual(r.supplied, [true, 3], 'paid, and the goods taken');
    assert.equal(r.after.length, 1, 'one supply order a day'); assert.match(r.after[0], /^📜 Pre-order/);
    assert.equal(r.paid, true); assert.equal(r.spo, 1); assert.equal(r.today, 0, 'nothing more today, and the order not yet in');
    assert.match(r.get[0], /^📦 Pick up your order: \d+ /); assert.equal(r.got, true); assert.equal(r.left, 0);
    assert.equal(r.tomorrow, 2, 'a new day, new contracts');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
