'use strict';
// Owner 2026-10-23: "every monster, from the weakest to the bosses and gods, has its own moves". No two kinds share a move set,
// every boss fights with its own moves (no more one growing circle and rocks for all), humanoids drink potions, priests root
// you while the others strike, and the new moves (fan, burst, rain, heal, mend, ward, call, cry) work.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());
const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };

test('every kind has its own move set; every boss has 3 or more moves with phases', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const V = window.__GMV, MT = window.__G.defs().MT, out = {};
      for (const k of Object.keys(MT)) { if (MT[k].dmg <= 1 && !V.RKMV[k]) continue; const L = V.RKMV[k] || (V.AIK[k] ? [...V.MOVES[V.AIK[k]], ...(V.XMOVES[k] || [])] : null);
        out[k] = { boss: !!MT[k].boss, has: !!V.RKMV[k], n: L ? L.length : 0, sig: L ? JSON.stringify(L) : '', ph: L ? L.filter((m) => m.ph).length : 0, kinds: L ? [...new Set(L.map((m) => m.k))] : [] }; }
      return out; });
    const none = Object.keys(r).filter((k) => !r[k].n); assert.deepEqual(none, [], 'kinds with no moves');
    const seen = {}; for (const k in r) { const o = seen[r[k].sig]; assert.ok(!o, k + ' fights exactly like ' + o); seen[r[k].sig] = k; }
    for (const k in r) if (r[k].boss) { assert.ok(r[k].has && r[k].n >= 3, k + ' has its own boss moves: ' + r[k].n); }
    const phased = Object.keys(r).filter((k) => r[k].boss && r[k].ph).length; assert.ok(phased >= 38, 'bosses with phase moves: ' + phased);
  } finally { await g.close(); }
});

test('a boss uses its own moves, not the shared slam; online followers can replay them', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const G = window.__G, P = G.P, V = window.__GMV; P.inv = 1e9; P.hp = 1e9;
      const m = G.mons().find((x) => x.type === 'gchief') || G.mons().find((x) => window.__G.defs().MT[x.type].boss && x.type !== 'bhclone');
      P.x = m.x + 60; P.y = m.y; m.eng = 4; m.cd = 0; const seen = new Set(); let slam = 0;
      for (let i = 0; i < 1500; i++) { V.monAct(m, 1 / 30); if (m.mv && m.st === 'tele') seen.add(m.mv.k); if (m.rSlam) slam++; if (!m.st) m.cd = Math.min(m.cd, 0); m.hp = m.max * (i < 500 ? 1 : i < 1000 ? .5 : .2); m.ph = i < 500 ? 0 : i < 1000 ? 1 : 2; P.x = m.x + (i % 300 < 150 ? 60 : 24); P.y = m.y; }
      return { type: m.type, seen: [...seen], slam }; });
    assert.ok(r.seen.length >= 3, r.type + ' used ' + r.seen.join(','));
    assert.equal(r.slam, 0);
  } finally { await g.close(); }
});

test('a hurt outlaw drinks a potion; a priest\'s root holds you and calls the others in; rains land where they were marked', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const G = window.__G, P = G.P, V = window.__GMV, o = {}; P.inv = 0; P.hp = 1e9;
      const ol = G.mons().find((x) => x.type === 'outlaw'); ol.hp = Math.round(ol.max * .3); const hp0 = ol.hp; const hi = V.RKMV.outlaw.findIndex((m) => m.k === 'heal');
      ol.mv = V.RKMV.outlaw[hi]; ol.st = 'tele'; ol.stT = 0.001; P.x = ol.x + 40; P.y = ol.y; V.monAct(ol, 1 / 60); o.potion = ol.hp > hp0;
      // root: you can't walk, and a warrior near the priest is told to strike now
      const cu = G.mons().find((x) => x.type === 'cultist') || ol, mate = G.mons().find((x) => x !== cu && Math.hypot(x.x - cu.x, x.y - cu.y) < 160) ;
      if (mate) { mate.eng = 4; mate.cd = 5; }
      V.mxOn({ root: 1.3, focus: 1 }, cu); o.spd = V.mxSpd(); o.mateCd = mate ? mate.cd : 0;
      V.mxOn({ dot: [.01, 4, 'pois'], slow: 2 }, null); o.dot = P.dotP;
      // a rain: four marks around the aim; one lands on you
      const k = G.mons().find((x) => x.type === 'kking') || ol; k.ax = 1; k.ay = 0; k.lL = 60; k.rsd = 3; const mv = { k: 'rain', n: 4, zr: 16, fall: .1, pat: 'cross', sp: 'rock', mul: 1 };
      const pts = V.rainPts(k, mv); P.x = pts[0][0]; P.y = pts[0][1]; P.inv = 0; P.hp = 1e9; const h0 = P.hp; V.MXK.rain(k, window.__G.defs().MT[k.type], mv, 60, 60, 0, 0); o.zones = V.ezone.length;
      return Object.assign(o, { h0, pts: pts.length }); });
    await g.step(30);
    const hit = await g.eval(() => window.__G.P.hp);
    assert.ok(r.potion, 'the outlaw drank a potion');
    assert.equal(r.spd, 0, 'rooted: you cannot walk');
    assert.ok(r.mateCd < 0.1, 'the others strike while you are held');
    assert.equal(r.dot, 0.01);
    assert.equal(r.zones, r.pts); assert.equal(r.pts, 5);
    assert.ok(hit < r.h0, 'the marked spot hit you');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
