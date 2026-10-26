'use strict';
// v3.11 The Vatican (places from the novel; owner 2026-10-25: "add any place or region of the novel that has an effect"): half
// a day south of Rolling (Rolling's landmark); its backyard where Isabel cries, its front door with Luna, Rin judged by the
// 13th Pope Drevigo (ch 118, 122-123); [Help the Rebecca Church!] "Kill Pope Drevigo!", Goddess Rebecca's blessing (ch 123);
// light, Goddess' Breath (ch 125-126); Damian binding the paladins' feet (ch 127); Franz's treasures (ch 128).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the place: walls, gate and lane, cathedral, garden and square, a town; its people; the hall under the map; no beast inside', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, U = window.__GU, V = window.__GVT.V, C = V.cat, Hh = V.hall, z = (x, y) => G.zoneAt(x * 16 + 8, y * 16 + 8), o = {};
      o.zones = [z(C.x + 8, C.y + C.h + 4), z(V.gx, V.y0 - 4), z(V.x1 + 1, V.y0 + 10), z(Hh.x0 + 8, Hh.cy)];
      o.wall = [U.at(V.x0, V.y0 + 10), U.at(V.x1, V.y0 + 10), U.at(V.gx + 6, V.y0), U.at(V.gx, V.y0), U.at(V.gx, V.y0 - 4), U.at(C.x + 3, C.y + 4)];
      const ppl = {}; for (const id of ['isabel', 'luna', 'vpriest', 'rin', 'damian']) { const n = G.npcs.find((x) => x.id === id); ppl[id] = n ? z(n.x / 16 | 0, n.y / 16 | 0) : null; }
      o.ppl = ppl;
      o.inside = G.mons().filter((m) => !m.dead && m.x / 16 >= V.x0 && m.x / 16 <= V.x1 + 1 && m.y / 16 >= V.y0 && m.y / 16 <= V.y1).map((m) => m.type);
      const d = window.__GVT.door(), u = window.__GVT.up(); o.door = !!d && !!u && z(d.to.x / 16 | 0, d.to.y / 16 | 0) === 'zVatH' && z(u.to.x / 16 | 0, u.to.y / 16 | 0) === 'zVatican';
      o.miss = window.__GMON.missing();
      return o;
    });
    assert.deepEqual(r.zones, ['zVatican', 'zDran', 'zDran', 'zVatH']);
    // 8 walls (and the gate's path, 2, in the north wall and on the lane), 7 the cathedral
    assert.deepEqual(r.wall, [8, 8, 8, 2, 2, 7]);
    assert.deepEqual(r.ppl, { isabel: 'zVatican', luna: 'zVatican', vpriest: 'zVatican', rin: 'zVatH', damian: 'zVatH' });
    assert.deepEqual(r.inside, [], 'the dice that fell inside the walls moved out');
    assert.equal(r.door, true);
    assert.deepEqual(r.miss, []);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the quest: Luna keeps the door until Isabel asks; the pope, his light, Goddess\' Breath, Damian\'s binding; the blessing and Franz\'s treasures', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, VT = window.__GVT, o = {};
      S.lv = 200; o.shut = VT.gate(); G.DL = null;
      o.offer = [G.QD.vat1.by, G.QD.vat1.lv, G.QD.vat1.obj.it];
      G.acceptQ('vat1'); o.open = VT.gate();
      // into the hall: the pope and two paladins appear, for you only
      const u = VT.door(); P.x = u.to.x; P.y = u.to.y; VT.tick(.1);
      const F = VT.F(); o.spawn = F && [F.m.type, F.pals.map((m) => m.type), F.m.tmp, !!G.isk.MT.drevigo.boss];
      // (review) at the door he waits; come near and he turns on you; Damian binds the paladins; not shared online
      for (let i = 0; i < 60; i++) VT.tick(.1); o.wait = F.on; o.sync = [F.m, ...F.pals].some((m) => window.__GTD.shared(m));
      P.x = F.m.x - 200; P.y = F.m.y; VT.tick(.1); o.on = F.on; o.bound = F.pals.every((m) => m.stun > 0);
      const mv = window.__GMV.RKMV.drevigo; o.moves = [mv.some((m) => m.sp === 'holy'), mv.some((m) => m.k === 'heal' && m.say === 'vtBreath')];
      // he falls
      F.m.hp = 1; window.__GU.hitMon(F.m, 50, {}); for (let i = 0; i < 5; i++) VT.tick(.1);
      o.won = [F.m.dead, F.won, F.pals.every((m) => m.dead), S.qs.vat1.c >= 1];
      // leave: the hall forgets the fight; back with the quest ready, no pope again
      P.x = VT.door().x; P.y = VT.door().y + 30; VT.tick(.1); o.gone = !VT.F(); P.x = u.to.x; P.y = u.to.y; VT.tick(.1); o.again = !!VT.F();
      // Isabel: the blessing and Franz's treasures
      const n0 = S.items.length; G.completeQ('vat1'); o.items = S.items.slice(n0).map((i) => i.id + ':' + i.r).sort(); o.bl = VT.bl();
      return o;
    });
    assert.equal(r.shut, false, 'Luna keeps the door');
    assert.deepEqual(r.offer, ['isabel', 195, 'drevigo']);
    assert.equal(r.open, true);
    assert.deepEqual(r.spawn, ['drevigo', ['vpal', 'vpal'], 1, true]);
    assert.equal(r.wait, 0, 'he waits until you come near'); assert.equal(r.sync, false);
    assert.equal(r.on, 1); assert.equal(r.bound, true);
    assert.deepEqual(r.moves, [true, true]);
    assert.deepEqual(r.won, [true, 1, true, true]);
    assert.equal(r.gone, true); assert.equal(r.again, false);
    assert.deepEqual(r.items, ['flarmor:3', 'flcrown:3', 'flgloves:3']);
    assert.equal(r.bl, true);
    // the blessings: corrupt beings take more; a rabbit does not
    const b = await g.eval(() => { const G = window.__G, VT = window.__GVT, mk = (t) => ({ type: t, spar: 0 }); const a = [VT.atk(mk('skel')), VT.atk(mk('rabbit'))];
      // the priest's blessing on a weapon: the fair price now, +15% more on corrupt beings
      const S = G.S, it = G.eqx.mkItem('isword', 0); S.items.push(it); G.isk.equip(it); S.gold = 1e6; const p = VT.price(); VT.bless(it); return { a, p, bls: it.bls, k: VT.atk(mk('skel')), tip: /Rebecca/.test(VT.tip(it)) }; });
    assert.deepEqual(b.a, [1.1, 1]);
    assert.ok(b.p <= 8000, 'the fair donation after the reform: ' + b.p);
    assert.equal(b.bls, 1); assert.ok(Math.abs(b.k - 1.265) < 1e-9, String(b.k)); assert.equal(b.tip, true);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
