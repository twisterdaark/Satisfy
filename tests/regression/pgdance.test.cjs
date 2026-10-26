'use strict';
// Pagma's sword dances as in the novel (owner: "1:1 with the novel"; legends/legend-audit.md §1), on one scale: the
// novel's damage x0.4 and its cooldowns /20. Link is a flurry on one target, Kill bleeds and brings despair for a fifth of your
// stamina (v3.14, ch 394), Wave rings out and slows, Restraint keeps all but the undead away, Transcend doubles attack and sends your cuts
// flying, Revolve sends a blow back, Pinnacle ignores 60% of the armour (here: of the level gap).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());
const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const setup = (g) => g.eval(() => { const G = window.__G; G.S.cls = 'pagma'; G.S.lv = 200; G.S.pgMur = 1; G.S.qs.dp2 = { st: 2, c: 1 }; G.P.hp = 1e6;
  for (const m of G.mons()) m.dead = true; });
const mon = (g, dx, dy, type) => g.eval(([dx, dy, type]) => { const G = window.__G, m = G.spawnMon(type || 'forc', G.P.x + dx, G.P.y + dy); m.max = m.hp = 1e9; m.tmp = 0; m.lv = 1;
  window.__pgM = (window.__pgM || []).concat(m); return window.__pgM.length - 1; }, [dx, dy, type]);
const hp = (g, i) => g.eval((i) => 1e9 - window.__pgM[i].hp, i);
const cast = (g, k) => g.eval((k) => { window.__G.P.mp = 1e6; window.__G.P.acd = 0; window.__GSKF.cast(k); }, k);

test('Link is a flurry on one target; Kill bleeds, brings despair and costs a fifth of your stamina', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK); await setup(g);
    const a = await mon(g, 16, 0), b = await mon(g, 70, 0);
    await cast(g, 'link'); await g.step(60);
    assert.ok(await hp(g, a) > 0, 'the nearest takes the flurry'); assert.equal(await hp(g, b), 0, 'the one further off is untouched');
    const st0 = await g.eval(() => { const P = window.__G.P; P.st = 100; return P.st; });
    await cast(g, 'kill'); await g.step(2);
    const r = await g.eval(() => ({ bl: !!window.__pgM[0].bl, weak: window.__pgM[0].weak > 0, st: window.__G.P.st }));
    assert.equal(r.bl, true); assert.equal(r.weak, true); const ms = await g.eval(() => window.__GLG3.ms()); assert.ok(Math.abs(st0 - r.st - ms * 0.2) < 2, 'stamina: 20% (v3.14, ch 394): ' + r.st + ' of ' + ms);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Wave slows what is beside you and homes on those further off; Restraint holds all but the undead off', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK); await setup(g);
    const a = await mon(g, 18, 0), b = await mon(g, -80, 0);
    await cast(g, 'wave'); await g.step(40);
    assert.ok(await hp(g, a) > 0); assert.ok(await hp(g, b) > 0, 'a homing wave reaches the far one');
    assert.ok(await g.eval(() => window.__pgM[0].slowU > window.__GPG.gt()));
    await g.eval(() => { for (const m of window.__pgM) m.dead = true; window.__pgM = []; });
    const c = await mon(g, 0, 22), s = await mon(g, 22, 0, 'skel');
    await cast(g, 'restraint'); await g.step(30);
    const d = await g.eval(() => window.__pgM.map((m) => Math.hypot(m.x - window.__G.P.x, m.y - window.__G.P.y)));
    assert.ok(d[0] >= 40, 'held off: ' + d[0]); assert.ok(d[1] < 40, 'the undead walk in: ' + d[1]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Transcend doubles attack and the cuts fly; Revolve sends a blow back; Pinnacle cuts through the level gap', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK); await setup(g);
    const dm0 = await g.eval(() => window.__GPG.dm());
    await cast(g, 'transcend'); await g.step(2);
    const r = await g.eval(() => { const G = window.__G, n = G.proj.length; G.P.acd = 0; G.tryAttack(1, 0); return { dm: window.__GPG.dm(), shot: G.proj.length - n }; });
    assert.ok(Math.abs(r.dm / dm0 - 2) < 1e-6, 'x' + r.dm / dm0); assert.equal(r.shot, 1);
    const a = await mon(g, 16, 0);
    await cast(g, 'revolve');
    const v = await g.eval(() => { const G = window.__G, h0 = G.P.hp, got = window.__GPG.hurt(500, window.__pgM[0]); return { got, lost: h0 - G.P.hp }; });
    assert.equal(v.got, 0); assert.equal(v.lost, 0); assert.ok(await hp(g, a) > 0, 'the blow went back');
    const pen = await g.eval(() => { const m = window.__pgM[0]; m.lv = 300; return window.__GPG.pen(m); });
    assert.ok(pen > 2, 'pen ' + pen);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
