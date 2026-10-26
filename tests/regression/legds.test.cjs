'use strict';
// Legends against the novel, step 1 (owner 2026-10-22): every legend resists status conditions ("[You have resisted.]",
// ch 182, 297), and the Demon Slayer is a legend: refusing Amoract gives the class at level 1 with stats reset (ch 262),
// one per world, with her novel kit (Brilliance Sword, the bullets, Light of Destruction on demonkin, Hell Summoning,
// Hell Leap; hell is her true stage).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('legends resist stuns, and the Saintess too (Upright Heart, novel ch200); others do not', async () => {
  const g = await H.openGame({ storage: { satisfy_lang: 'en' } });
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const G = window.__G, S = G.S, D = window.__GDSL; const out = [];
      for (const c of ['pagma', 'braham', 'saint', 'dslayer', 'warrior', 'saintess']) { S.cls = c; out.push(D.resist()); } return out; });
    assert.deepEqual(r, [true, true, true, true, false, true]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Demon Slayer: the hidden quest ends in the legend at level 1, one per world; the kit casts', async () => {
  const g = await H.openGame({ storage: { satisfy_lang: 'en' } });
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P; S.cls = 'knight'; S.lv = 190; S.st = { str: 200, sta: 200, agi: 200, int: 200, dex: 200 };
      G.acceptQ('hds'); S.qs.hds.c = 30; G.completeQ('hds');
      return { cls: S.cls, lv: S.lv, st: S.st, rec: !!(G.S && window.__GL.legends().alex), leg: window.__GDSL.resist() }; });
    assert.equal(r.cls, 'dslayer'); assert.equal(r.lv, 1); assert.deepEqual(r.st, { str: 10, sta: 10, agi: 10, int: 10, dex: 10 });
    assert.ok(r.rec, 'the world record holds the Demon Slayer'); assert.ok(r.leg);
    // a second Demon Slayer is not offered while the first is someone else's
    const o = await g.eval(() => { const G = window.__G, S = G.S, X = window.__GP2, Hc = window.__GHC.s(); window.__GL.legends().alex = { pid: 'u:other', n: 'Yura' };
      delete S.qs.hds; S.cls = 'knight'; S.lv = 190; Hc.dm = 200; const a = X.offerK(); delete window.__GL.legends().alex; const b = X.offerK(); return [a, b]; });
    assert.deepEqual(o, [null, 'hds']);
    await g.eval(() => { const G = window.__G, S = G.S, P = G.P; S.cls = 'dslayer'; S.lv = 150; P.inv = 1e9; P.hp = 1e9; P.mp = 1e6; P.x = 90 * 16; P.y = 60 * 16; P.dir = 2;
      for (const m of G.mons()) { m.dead = true; m.rt = 1e9; } const m = G.spawnMon('demon', P.x + 40, P.y); m.max = m.hp = 1e9; m.lv = 150; m.tmp = 0; window.__m = m; S.dmEss = 50; });
    const k = await g.eval(() => { const G = window.__G, X = window.__GP2, m = window.__m; const casts = ['dscut', 'dsbul', 'dsvind', 'dspure', 'dsend', 'dsseal', 'dsdest', 'dssum'];
      for (const c of casts) X.sk(c); return { lod: m.lod > 0, ess: G.S.dmEss, reg: window.__GDSL.reg(), hurt: X.hurt(100, m), hell: window.__GDSL.hell(), cdm: window.__GDSL.cdm('dscut'), half: window.__GDSL.cdm('dsdest') }; });
    assert.ok(k.lod, 'Light of Destruction marks the demon'); assert.equal(k.ess, 0, 'and spends the Demonic Essence (v3.17)'); assert.equal(k.reg, true, 'Hell Regulation (v3.17)');
    assert.equal(k.hurt, 38, 'a marked demon does half (and Bane takes a quarter off)');
    const hr = await g.eval(() => { const G = window.__G, P = G.P, m = window.__m; const hit = () => { P.inv = 0; P.dash = 0; P.hp = 1e9; window.__GSS2.hurt(1000, m); return 1e9 - P.hp; }; const a = hit(); const u = P.hrgU; P.hrgU = 0; const b = hit(); P.hrgU = u; P.inv = 1e9; return a / b; });
    assert.ok(Math.abs(hr - 0.5) < 0.05, 'Hell Regulation halves a demon\'s blows (v3.17): ' + hr);
    assert.ok(k.hell, 'Hell Summoning makes your own hell'); assert.equal(k.cdm, .8); assert.equal(k.half, .5);
    // Hell Leap (v3.17, ch 1536): a flash step, not a trip
    const l = await g.eval(() => { const G = window.__G, P = G.P, x0 = P.x, y0 = P.y; window.__m.dead = true; P.inv = 0; P.dir = 2; window.__GP2.sk('dsleap'); const far = Math.hypot(P.x - x0, P.y - y0); return [far > 40 && far <= 150, P.inv > 0, !window.__GDSL.DSH.lp, Math.round(far)]; });
    assert.deepEqual(l.slice(0, 3), [true, true, true], 'Hell Leap: a flash step of up to 9 m: ' + JSON.stringify(l));
    // Light of Destruction does nothing to a wolf and gives most of its cooldown back
    const w = await g.eval(() => { const G = window.__G, P = G.P; window.__m.dead = true; const m = G.spawnMon('wolf', P.x + 30, P.y); m.max = m.hp = 1e6; m.tmp = 0; const h = m.hp; P.cd.dsdest = 900; G.S.dmEss = 50; window.__GP2.sk('dsdest'); return [m.hp === h, P.cd.dsdest, G.S.dmEss]; });
    assert.equal(w[0], true); assert.ok(w[1] <= 20); assert.equal(w[2], 50, 'no demon hit, no essence spent');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Demonic Essence: demons leave it, Light of Destruction needs 5 and grows with what it spends', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, D = window.__GDSL, o = {};
      S.cls = 'dslayer'; S.lv = 150; S.sk = {}; G.isk.checkSkills(); S.dmEss = 0; P.inv = 1e9; P.mp = 1e6; P.dir = 2;
      for (const m of G.mons()) { m.dead = true; m.rt = 1e9; }
      const d = G.spawnMon('demon', P.x + 40, P.y); d.myd = 10; D.kill(d); const w = G.spawnMon('wolf', P.x + 40, P.y); w.myd = 10; D.kill(w); o.gain = S.dmEss;
      const n = G.spawnMon('demon', P.x + 40, P.y); n.myd = 0; D.kill(n); o.noShare = S.dmEss;
      d.dead = w.dead = n.dead = true;
      S.dmEss = 4; const m = G.spawnMon('demon', P.x + 40, P.y); m.max = m.hp = 1e12; m.lv = 150; m.tmp = 0; P.cd = {}; window.__GSS2.cast('dsdest'); o.need = [m.hp === m.max, S.dmEss];
      const shot = (e) => { let t = 0; for (let i = 0; i < 12; i++) { S.dmEss = e; P.cd = {}; m.hp = m.max; window.__GSKF.cast('dsdest'); t += m.max - m.hp; } return t / 12; };
      o.grow = shot(500) / shot(5);
      return o;
    });
    assert.equal(r.gain, 1, 'a demon you helped kill leaves one; a wolf none');
    assert.equal(r.noShare, 1, 'none from a demon you never hit');
    assert.deepEqual(r.need, [true, 4], 'Light of Destruction needs 5');
    assert.ok(r.grow > 1.7 && r.grow < 2.2, '500 essences add about 5,000% to its 5,500%: ' + r.grow);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
