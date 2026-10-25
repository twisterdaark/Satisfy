'use strict';
// Earl Zebra's castle (v2.94; owner 2026-10-25: "add any place or region of the novel that has an effect"): the castle on the
// way from Reidan to Titan with its keep and its underground (ch 243), the Black Arrows (ch 245-246), the Slaughterer of the
// underground and its eye patch, Unique, with Vital Spot Detection (ch 243-244), Lauel's errand for it (ch 243).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };

test('the place: a walled court with its gate and keep south of Titan, the way down from the keep\'s door; the Black Arrows in the court, the Slaughterer below, Earl Zebra before his keep', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, U = window.__GU, Z = window.__GZB.Z, K = Z.keep, P = Z.pit, n = {}, zones = {};
      for (const m of G.mons()) if (m.type === 'bkarrow' || m.type === 'slaught') { n[m.type] = (n[m.type] || 0) + 1; zones[m.type + ':' + G.zoneAt(m.x, m.y)] = 1; }
      const zb = G.npcs.find((x) => x.id === 'zebra');
      return { zc: G.zoneAt((Z.gx) * 16, (Z.y0 + 4) * 16), zu: G.zoneAt((P.x0 + 6) * 16, P.cy * 16), zout: G.zoneAt((Z.x1 + 3) * 16, (Z.y0 + 4) * 16),
        wall: [U.at(Z.x0, Z.y0 + 5), U.at(Z.x1, Z.y0 + 5), U.at(Z.gx - 4, Z.y0), U.at(Z.gx, Z.y0), U.at(Z.gx, Z.y1)], keep: U.at(K.x + 2, K.y + 3),
        n, zones: Object.keys(zones).sort(), zb: zb && G.zoneAt(zb.x, zb.y), boss: G.isk.MT.slaught.boss, miss: window.__GMON.missing(), apart: ['bkarrow', 'slaught', 'gworm'].map((k) => window.__GZB.apart(k)) };
    });
    assert.deepEqual([r.zc, r.zu, r.zout], ['zZebra', 'zZebraU', 'zSahFarm']);
    // 8 walls, 2 the path through the gate; 7 the keep
    assert.deepEqual(r.wall, [8, 8, 8, 2, 8]); assert.equal(r.keep, 7);
    assert.deepEqual(r.n, { bkarrow: 7, slaught: 1 }); assert.deepEqual(r.zones, ['bkarrow:zZebra', 'slaught:zZebraU']);
    assert.equal(r.zb, 'zZebra'); assert.equal(r.boss, 1); assert.deepEqual(r.miss, []);
    assert.deepEqual(r.apart, [true, true, true], 'regions of their own, by kind (it lasts through a respawn): no town level, no invasion strength');
    // the way down: the keep's door to the far end of the underground, and back up before the keep
    const gates = await g.eval(() => window.__GZB.gates());
    const Zc = await g.eval(() => window.__GZB.Z);
    assert.equal(gates.length, 2);
    const down = gates.find((x) => x[0] === 'hZebra'), up = gates.find((x) => x[0] === 'hUp');
    assert.deepEqual(down.slice(1), [Zc.keep.x + 3, Zc.keep.y + Zc.keep.h, Zc.pit.x0 + 4, Zc.pit.cy]);
    assert.deepEqual(up.slice(3), [Zc.keep.x + 3, Zc.keep.y + Zc.keep.h + 2]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('their ways and the eye patch: the Black Arrows come from behind and throw five daggers; the Slaughterer has its moves and its frenzy; the eye patch gives Vital Spot Detection; Lauel\'s errand gives it once', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, V = window.__GMV, S = G.S, out = {};
      const ba = V.RKMV.bkarrow, sl = V.RKMV.slaught;
      out.ba = [ba.some((m) => m.k === 'blink' && m.behind), ba.some((m) => m.k === 'fan' && m.n === 5 && m.sp === 'knife')];
      out.sl = [sl.length >= 3, sl.filter((m) => m.ph).length >= 2, sl.some((m) => m.k === 'cry' && m.ph === 2)];
      out.before = G.isk.ipOn('vspot');
      S.lv = 260; S.qs.zeb1 = { st: 1, c: 1 }; const n0 = S.items.length; G.completeQ('zeb1');
      const it = S.items.find((i) => i.id === 'speye'); out.got = [S.items.length - n0, !!it, S.qs.zeb1.st];
      if (it) G.isk.equip(it); out.after = G.isk.ipOn('vspot');
      out.offer = [G.QD.zeb1.by, G.QD.zeb1.lv, G.QD.zeb1.obj.it];
      // the landmark: the first discovery once the errand is yours
      const N = window.__GNPC, x0 = S.xp; N.fdLm('lmZebra'); out.fd = [!!S.books.fd_zebra, S.xp > x0];
      return out;
    });
    assert.deepEqual(r.ba, [true, true]); assert.deepEqual(r.sl, [true, true, true]);
    assert.equal(r.before, false); assert.deepEqual(r.got, [1, true, 2]); assert.equal(r.after, true);
    assert.deepEqual(r.offer, ['lauel', 205, 'slaught']);
    assert.deepEqual(r.fd, [true, true]);
    // Earl Zebra: his word, his topics, no gifts
    await g.eval(() => window.__G.talkNPC('zebra')); await g.step(10);
    const say = await g.eval(() => document.getElementById('dtext').textContent);
    assert.match(say, /Zebra/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
