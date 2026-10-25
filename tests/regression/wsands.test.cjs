'use strict';
// Reidan's Western Sands (v2.93; owner 2026-10-25: "add any place or region of the novel that has an effect"): the land west
// of Reidan's wall turned to sand by the giant worms (ch 217, 228), the worms' nest below the mountain and the desert toads
// (ch 230), Administrator Rabbit's two quests, two landmarks with their first discoveries.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };

test('the place: sand west of Reidan with the same tiles solid as before, the road kept; its creatures there and nowhere in a town; the road\'s beasts moved off it', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, U = window.__GU, W = window.__GWS.W, tiles = {}, inW = (m) => m.x / 16 >= W.x0 && m.x / 16 < W.x1 + 1 && m.y / 16 >= W.y0 && m.y / 16 < W.y1 + 1;
      for (let y = W.y0; y <= W.y1; y++) for (let x = W.x0; x <= W.x1; x++) { const v = U.at(x, y); tiles[v] = (tiles[v] || 0) + 1; }
      const n = {}, zones = {}, town = [];
      for (const m of G.mons()) if (['gworm', 'dtoad', 'gwnest'].includes(m.type)) { n[m.type] = (n[m.type] || 0) + 1; zones[G.zoneAt(m.x, m.y)] = 1; if (window.__GOG.town(m.x, m.y)) town.push(m.type); }
      return { tiles, road: [U.at(494, 78), U.at(500, 78)], z: [G.zoneAt(494 * 16, 76 * 16), G.zoneAt(470 * 16, 76 * 16), G.zoneAt(520 * 16, 76 * 16)], n, zones: Object.keys(zones), town,
        beasts: G.mons().filter((m) => ['rboar', 'hwolf', 'gbear'].includes(m.type) && inW(m)).length,
        kinds: ['gworm', 'dtoad', 'gwnest'].map((k) => window.__GXP.kind(k)), miss: window.__GMON.missing() };
    });
    // 0 grass, 1 flowers, 3 trees: none left; 10 sand, 11 rocks (the trees were), 2 the road
    for (const k of ['0', '1', '3']) assert.equal(r.tiles[k], undefined, 'tile ' + k + ' on the sand');
    assert.ok(r.tiles['10'] > 1000 && r.tiles['11'] > 20, JSON.stringify(r.tiles));
    assert.deepEqual(r.road, [2, 2], 'the road from Patrian crosses it');
    assert.deepEqual(r.z, ['zWSand', 'zRoadR', 'zReid']);
    assert.deepEqual(r.n, { dtoad: 12, gworm: 9, gwnest: 1 });
    assert.deepEqual(r.zones, ['zWSand']); assert.deepEqual(r.town, []);
    assert.equal(r.beasts, 0, 'no boar, wolf or bear of the road on the sand');
    assert.deepEqual(r.kinds, ['mob', 'mob', 'mob']); assert.deepEqual(r.miss, []);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('their rules: a worm under the sand is not hurt and goes after you; it bursts up biting whoever is in the ring; the nest takes half while a worm guards it and wakes them; one toad brings the others', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, U = window.__GU, O = window.__GOG, WS = window.__GWS, MT = G.isk.MT, S = G.S, out = {};
      S.lv = 160; S.hid.indom = 0; G.P.hp = G.P.max = 1e12;
      const at = (k, dx, dy) => { const m = G.spawnMon(k, G.P.x + dx, G.P.y + (dy || 0)); m.tmp = 1; m.lv = 160; m.hp = m.max = 1e9; return m; };
      // put a worm's round where it is wanted: its seed is from where it lives
      const phase = (m, lo, hi) => { const x0 = m.sx; for (let i = 0; i < 4000; i++) { m.sx = x0 + i; const p = WS.ph(m); if (p >= lo && p < hi) return true; } return false; };
      const hit = (m) => { const h0 = m.hp; U.hitMon(m, 1, {}); return h0 - m.hp; };
      const w = at('gworm', 60); w.eng = 4;
      out.found = [phase(w, .1, .5)]; out.under = WS.st(w); out.underHit = hit(w); const x0 = w.x;
      O.OGB.gworm(w, MT.gworm, G.P.x - w.x, G.P.y - w.y, Math.hypot(G.P.x - w.x, G.P.y - w.y), 3, .1, false); out.went = w.x < x0;
      // the heave, then up: in the ring it bites (1.6 times its blow), out of it nothing
      const bite = (dx) => { w.x = G.P.x + dx; w.y = G.P.y; out.found.push(phase(w, .62, .7)); G.P.inv = 0; O.OGB.gworm(w, MT.gworm, -dx, 0, Math.abs(dx), 3, .016, false); const h0 = G.P.hp; out.found.push(phase(w, .74, .95)); G.P.inv = 0;
        O.OGB.gworm(w, MT.gworm, -dx, 0, Math.abs(dx), 3, .016, false); return h0 - G.P.hp; };
      out.inRing = bite(12); out.outRing = bite(WS.ring() + 20); out.up = WS.st(w); out.upHit = hit(w) > 0;
      // a town keeps it under
      out.safe = O.OGB.gworm(w, MT.gworm, 0, 0, 10, 3, .016, true) && !(w.eng > 0); w.dead = true;
      // the nest: half while a worm is within 220 px, whole without; someone near wakes the worms within 320 px
      const n = at('gwnest', 0, 80), g1 = at('gworm', 100, 80); g1.eng = 0;
      out.wake = (O.OGB.gwnest(n, MT.gwnest, G.P.x - n.x, G.P.y - n.y, 80, 3, .016, false), g1.eng > 0);
      out.pinned = (n.x += 30, O.OGB.gwnest(n, MT.gwnest, 0, 0, 200, 3, .016, false), n.x === n.sx);
      const avg = () => { let a = 0; for (let i = 0; i < 30; i++) a += hit(n); return a / 30; };
      const guarded = avg(); g1.dead = true; const alone = avg(); out.guard = guarded / alone;
      n.dead = true;
      // the toads: one fighting brings every toad within 200 px
      const t1 = at('dtoad', 0, -150), t2 = at('dtoad', 120, -150), t3 = at('dtoad', 500, -150); t1.eng = 4;
      O.OGB.dtoad(t1, MT.dtoad, 0, 150, 150, 3, .016, false); out.toads = [t2.eng > 0, !(t3.eng > 0)]; t1.dead = t2.dead = t3.dead = true;
      return out;
    });
    assert.ok(r.found.every(Boolean), 'phases found');
    assert.equal(r.under, 'under'); assert.equal(r.underHit, 0, 'under the sand it is not hurt'); assert.equal(r.went, true, 'it goes after you under the sand');
    assert.ok(r.inRing > 0, 'in the ring it bites: ' + r.inRing); assert.equal(r.outRing, 0, 'out of the ring nothing');
    assert.equal(r.up, 'up'); assert.equal(r.upHit, true, 'up, it can be hurt');
    assert.equal(r.safe, true, 'a town keeps it under');
    assert.equal(r.wake, true, 'the nest wakes the worms'); assert.equal(r.pinned, true, 'the nest does not move');
    assert.ok(r.guard > .4 && r.guard < .6, 'guarded, the nest takes half: ' + r.guard);
    assert.deepEqual(r.toads, [true, true]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Rabbit: the west on his map (two first discoveries), his two quests in turn (no title); his word once the nest is gone', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, N = window.__GNPC, out = {}; S.lv = 160; S.met.admRabbit = 1;
      // a rumour first, then the place: the first discovery once
      N.fdLm('lmWSand'); out.pre = !!(S.books || {}).fd_wsand;
      N.topic('admRabbit', 'reidan'); G.advance(); G.advance(); G.advance(); const x0 = S.xp; N.fdLm('lmWSand'); out.sand = !!S.books.fd_wsand; out.xp = S.xp - x0; N.fdLm('lmWSand'); out.again = S.xp - x0 - out.xp;
      out.q2first = !!G.QD.wsq2 && !Object.keys(S.qs).includes('wsq2');
      S.qs.wsq1 = { st: 1, c: 0 };
      N.topic('admRabbit', 'west'); for (let i = 0; i < 4; i++) G.advance(); N.fdLm('lmWNest'); out.nest = !!S.books.fd_wnest;
      S.qs.wsq1.c = 12; const g0 = S.gold; G.completeQ('wsq1'); out.q1 = [S.qs.wsq1.st, S.gold - g0];
      S.qs.wsq2 = { st: 1, c: 1 }; const m0 = S.mats.mstone || 0, g1 = S.gold, t0 = Object.keys(S.tl || {}).length; G.completeQ('wsq2'); out.q2 = [S.qs.wsq2.st, S.gold - g1, (S.mats.mstone || 0) - m0, Object.keys(S.tl || {}).length - t0];
      out.pool = N.pool('admRabbit');
      return out;
    });
    assert.equal(r.pre, false, 'not before the rumour'); assert.equal(r.sand, true); assert.ok(r.xp > 0); assert.equal(r.again, 0, 'once');
    assert.equal(r.nest, true, 'the nest after his word about it');
    assert.deepEqual(r.q1, [2, 8000]); assert.deepEqual(r.q2, [2, 15000, 10, 0], 'no title (owner 2026-10-25: fewer titles)');
    assert.ok(r.pool.includes('nrb_c6'), 'his word once the nest is gone');
    // the quests are offered in turn by Rabbit (the second only after the first)
    const offer = await g.eval(() => { const G = window.__G, Q = G.QD; return { pre: Q.wsq2.pre, by: [Q.wsq1.by, Q.wsq2.by], spot: !!(Q.wsq1.spot && Q.wsq2.spot) }; });
    assert.deepEqual(offer, { pre: 'wsq1', by: ['admRabbit', 'admRabbit'], spot: true });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('a region of its own: Reidan\'s recommended level and its invasion\'s strength are Reidan\'s, the waystation is clear; a worm too far from home goes back under the sand; the nest calms down', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.step(5);
    const r = await g.eval(() => {
      const G = window.__G, O = window.__GOG, WS = window.__GWS, MT = G.isk.MT, out = {};
      out.lv = window.__GTLV.lv('zReid'); out.ref = WS.ref('zReid').lv;
      out.way = G.mons().filter((m) => ['gworm', 'dtoad', 'gwnest'].includes(m.type) && (Math.hypot(m.sx / 16 - 489, m.sy / 16 - 76) < 12 || Math.hypot(m.sx / 16 - 494, m.sy / 16 - 73) < 12)).length;
      // a worm dragged 300 px from home, someone 60 px from it, under the sand: home it goes, not fighting
      const w = G.mons().find((m) => m.type === 'gworm' && !m.dead); const sx = w.sx, sy = w.sy; w.x = sx + 300; w.y = sy; w.eng = 4; w.hp = w.max * .5;
      const phase = (lo, hi) => { for (let i = 0; i < 4000; i++) { w.sx = sx + i; w.x = w.sx + 300; const p = WS.ph(w); if (p >= lo && p < hi) return true; } return false; };
      out.found = phase(.05, .3); const d0 = Math.hypot(w.x - w.sx, w.y - w.sy);
      for (let i = 0; i < 30; i++) O.OGB.gworm(w, MT.gworm, -60, 0, 60, 3, .1, false);
      out.home = [w.ret === 1 || Math.hypot(w.x - w.sx, w.y - w.sy) < d0, !(w.eng > 0), w.hp > w.max * .5];
      w.x = w.sx; w.y = w.sy = sy; w.ret = 0;
      // the nest: woken, then no one near: it stops fighting
      const n = G.mons().find((m) => m.type === 'gwnest'); n.eng = 4; for (let i = 0; i < 60; i++) O.OGB.gwnest(n, MT.gwnest, 3000, 0, 3000, 3, .1, false); out.calm = !(n.eng > 0);
      return out;
    });
    // the road's beasts that moved west leave Reidan's level a little higher (95 before); the sands' Lv 150 does not set it
    assert.ok(r.lv >= 90 && r.lv <= 110, 'Reidan\'s recommended level: ' + r.lv); assert.ok(r.ref <= 110, 'the invasion\'s reference level (100 before): ' + r.ref);
    assert.equal(r.way, 0, 'nothing of the sands by the waystation or its banner');
    assert.equal(r.found, true); assert.deepEqual(r.home, [true, true, true], 'it goes home under the sand, healing, not fighting');
    assert.equal(r.calm, true, 'the nest calms down');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
