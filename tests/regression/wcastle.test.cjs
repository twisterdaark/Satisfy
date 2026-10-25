'use strict';
// Winston Castle (owner 2026-10-25: "add her father's house and Irene; add Administrator Rabbit"): Earl Steim, the lord of
// the north, in Winston Castle (ch 116); Irene, his only daughter, there once she is home (ch 116-117, the Irene quest);
// Administrator Rabbit in Reidan (ch 28-50 his Winston past, ch 221-228 Reidan's administrator) with his daily call (ch 856).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const say = (g) => g.eval(() => document.getElementById('dtext').textContent);
const optsOf = (g) => g.eval(() => [...document.querySelectorAll('#dopts button')].map((b) => b.textContent));
const closeD = (g) => g.eval(() => { const G = window.__G; for (let i = 0; i < 12 && G.mode === 'dialog'; i++) { const b = [...document.querySelectorAll('#dopts button')].find((x) => /Leave|Back|Close|Done/.test(x.textContent)); if (b) b.click(); else G.advance(); } });

test('Winston Castle: Winston\'s hall is the castle, with its own room; Earl Steim in it, Irene only once she is home; no other room moved', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.step(5);
    const r = await g.eval(() => {
      const G = window.__G, R = G.ROOMS.find((x) => x.id === 'r6'), n = (k) => G.npcs.find((x) => x.id === k), st = n('steim'), ir = n('irene');
      const inR = (o) => o.x / 16 >= R.rx && o.x / 16 < R.rx + 12 && o.y / 16 >= R.ry && o.y / 16 < R.ry + 8;
      const pos = Object.fromEntries(G.ROOMS.filter((x) => x.id !== 'r6').map((x) => [x.id, [x.rx, x.ry]]));
      const before = { hidden: !!ir.hidden };
      G.S.qs.irn = { st: 2, c: 0 };
      return { kind: R.kind, z: R.z, door: G.zoneAt(R.dx, R.dy), steimIn: inR(st), ireneIn: inR(ir), before, pos };
    });
    await g.step(5);
    const after = await g.eval(() => !!window.__G.npcs.find((x) => x.id === 'irene').hidden);
    assert.equal(r.kind, 'castle'); assert.equal(r.z, 'zWin'); assert.equal(r.door, 'zWin');
    assert.ok(r.steimIn && r.ireneIn, 'both in the castle\'s room');
    assert.equal(r.before.hidden, true, 'not there before her rescue'); assert.equal(after, false, 'there after it');
    // the rooms of the houses, inns and shops are where they were (r6 is new, apart from them)
    for (const [id, p] of Object.entries({ r0: [1, 280], r3: [27, 280], r9: [79, 280], r13: [105, 280], r23: [209, 280], rGH: [218, 288], r46: [53, 288] })) assert.deepEqual(r.pos[id], p, id);
    // a new world at every start (quit to the title, Continue): she is still where her quest says, not left visible
    await g.eval(() => { const S = window.__G.S; delete S.qs.irn; }); await g.step(3);
    await g.eval(() => window.__G.act('quit')); await g.waitMode('title');
    await H.continueGame(g); await g.step(5);
    const again = await g.eval(() => { const G = window.__G, ir = G.npcs.find((x) => x.id === 'irene'); return { hidden: !!ir.hidden }; });
    assert.equal(again.hidden, true, 'after Continue, before her rescue: not there');
    await g.eval(() => { window.__G.S.qs.irn = { st: 2, c: 0 }; }); await g.step(3);
    assert.equal(await g.eval(() => !!window.__G.npcs.find((x) => x.id === 'irene').hidden), false, 'after Continue, once home: there');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Earl Steim: his word once after the rescue, the son-in-law spoken to as one, Winston\'s honour opens him, the castle\'s oath once', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, N = window.__GNPC; S.met.steim = 1; S.qs.irn = { st: 2, c: 0 };
      const a = [N.idle('steim'), N.idle('steim')]; const pool = N.pool('steim'); S.tl = S.tl || {}; S.tl.sonlaw = 1; const pool2 = N.pool('steim');
      return { a, pool, pool2 };
    });
    assert.equal(r.a[0], 'nst_q1'); assert.notEqual(r.a[1], 'nst_q1');
    assert.ok(r.pool.includes('nst_c4') && !r.pool.includes('nst_c5'));
    assert.ok(r.pool2.includes('nst_c5') && !r.pool2.includes('nst_c4'), 'the son-in-law');
    // no gifts, but Winston's name opens him: Honoured (350) opens his 60s; Town Hero (700) his 90s
    await g.eval(() => { const S = window.__G.S; S.aff = { steim: 0 }; S.rep = { zWin: 360 }; window.__GNPC.topics('steim'); }); await g.step(5);
    let o = await optsOf(g);
    assert.ok(o.some((x) => /The Mero Company/.test(x)) && o.some((x) => /Irene/.test(x)), 'open: ' + o);
    assert.ok(o.some((x) => /or Town Hero in Winston/.test(x)), 'the oath locked, saying how: ' + o);
    await closeD(g);
    const oath = await g.eval(() => { const S = window.__G.S, N = window.__GNPC; S.rep.zWin = 700; const r0 = S.rep.zWin; N.topic('steim', 'oath'); const r1 = S.rep.zWin; window.__G.advance(); window.__G.advance(); N.topic('steim', 'oath'); return { tl: !!S.tl.wcastle, rep: r1 - r0, again: S.rep.zWin - r1 }; });
    assert.deepEqual(oath, { tl: false, rep: 50, again: 0 });   // Winston's honour, no title (owner 2026-10-25: fewer titles)
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Irene: her thanks, her topics, a hairpin she likes, her word in Winston at 90, no title', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(() => { const G = window.__G, S = G.S; S.qs.irn = { st: 2, c: 0 }; G.talkNPC('irene'); }); await g.step(20);
    assert.match(await say(g), /I'm Irene/);
    await closeD(g);
    const gift = await g.eval(() => { const G = window.__G, S = G.S; S.mats.hairpin = 2; const a0 = S.aff.irene | 0; G.eqx.giveGift('irene', 'hairpin'); return (S.aff.irene | 0) - a0; });
    assert.equal(gift, 24, 'a hairpin, which she likes: 12 twice');
    const r = await g.eval(() => { const S = window.__G.S, N = window.__GNPC; S.aff.irene = 90; S.rep = S.rep || {}; const r0 = S.rep.zWin | 0; N.topic('irene', 'thanks'); window.__G.advance(); window.__G.advance(); N.topic('irene', 'thanks'); return { tl: !!S.tl.ifriend, rep: (S.rep.zWin | 0) - r0 }; });
    assert.deepEqual(r, { tl: false, rep: 30 }, 'her word in Winston, once; no title');
    await g.eval(() => window.__GNPC.topic('irene', 'ian')); await g.step(5);
    assert.match(await say(g), /Bland de Ian/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Administrator Rabbit\'s Call: one errand a day (resources, security, the ledger to Lauel), gold once a day; his Mero Company past', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, W = window.__GWC; S.lv = 200; S.met.admRabbit = 1; const out = {};
      // each kind in turn: set today's errand by hand
      const run = (k) => { S.dly = null; const c = W.rc(); c.k = k; c.m = 1; const o1 = W.rcOpts(); o1[0].f(); G.advance && 0; const prog = W.rcOpts()[0].l;
        if (k === 'res') S.mats.ore = 25; if (k === 'sec') { const T = G.TOWNS.find((x) => x.k === 'zReid'); for (let i = 0; i < 8; i++) { const m = G.spawnMon('wolf', T.rx * 16, T.ry * 16 + 200); m.tmp = 0; W.rcKill(m); m.dead = true; m.rt = 1e9; } }
        if (k === 'led') { const lo = W.lauel(); out.lauelOpt = lo.length; lo[0].f(); }
        const g0 = S.gold, ore0 = S.mats.ore | 0; W.rcOpts()[0].f(); const turn = { gold: S.gold - g0, ore: ore0 - (S.mats.ore | 0) }; const again = W.rcOpts()[0].l; return { prog, turn, again }; };
      out.res = run('res'); out.sec = run('sec'); out.led = run('led'); out.gold = W.gold();
      return out;
    });
    assert.match(r.res.prog, /20 Ore|Ore/); assert.equal(r.res.turn.ore, 20); assert.equal(r.res.turn.gold, r.gold);
    assert.match(r.sec.prog, /0\/8/); assert.equal(r.sec.turn.gold, r.gold);
    assert.equal(r.lauelOpt, 1, 'Lauel signs the ledger'); assert.equal(r.led.turn.gold, r.gold);
    for (const k of ['res', 'sec', 'led']) assert.match(r[k].again, /done for today/);
    // over two months every errand and, for the resources, every material comes up
    const days = await g.eval(() => { const W = window.__GWC, k = {}, m = {}; for (let i = 0; i < 60; i++) { const d = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10), p = W.pick(d); k[p.k] = 1; if (p.k === 'res') m[p.m] = 1; } return { k: Object.keys(k).sort(), m: Object.keys(m).sort() }; });
    assert.deepEqual(days, { k: ['led', 'res', 'sec'], m: ['0', '1', '2'] });
    // Lauel talks as before unless he has the ledger to sign
    const la = await g.eval(() => { const S = window.__G.S, W = window.__GWC; const c = W.rc(); c.done = 1; const off = W.lauelN().opts; c.done = 0; c.on = 1; c.k = 'led'; c.led = 0; const on = typeof W.lauelN().opts; c.on = 0; return { off: off === undefined, on }; });
    assert.deepEqual(la, { off: true, on: 'function' });
    // his past: the contest at Khan's smithy, as it ended for you
    await g.eval(() => { const S = window.__G.S; S.qs.gj2 = { st: 2, c: 0 }; window.__GNPC.topic('admRabbit', 'mero'); }); await g.step(5); await g.eval(() => window.__G.advance()); await g.step(3);
    await g.eval(() => { const b = [...document.querySelectorAll('#dopts button')].find((x) => /what he did there/.test(x.textContent)); b.click(); }); await g.step(5);
    assert.match(await say(g), /Best bet I ever made/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
