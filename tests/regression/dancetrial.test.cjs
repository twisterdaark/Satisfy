'use strict';
// v3.24 (plan U354) The sword dance trial at Pagma's mural: the swordsman on it calls your dances one at a time, each within
// 2 s and in order; the grade is by the whole time, the best kept; an unlearned fusion danced inside its 9 s is learned.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the sword dance trial: a new fusion, a wrong dance, a late one', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, T = window.__GTRL; S.cls = 'pagma'; S.lv = 200; S.pgMur = 1; S.qs.dp2 = { st: 2, c: 1 }; S.sk = {}; S.fus = {}; G.isk.checkSkills(); P.hp = 1e6;
      for (const m of G.mons()) { m.dead = true; m.rt = 1e9; }
      const L = T.list(); const q = L.find((x) => x.f === 'lkill'); const o = { has: !!q, nw: q && q.nw, opt: T.opts().map((x) => x.l).join(' | ') };
      T.start(q); P.mp = 1e6; P.acd = 0; window.__GSS2.cast(q.seq[0]); o.after1 = T.R && T.R.i; return o; });
    assert.equal(r.has, true, 'Linked Kill is offered'); assert.equal(r.nw, true); assert.match(r.opt, /Trial: Kill → Link \(a new fusion\)/);
    assert.equal(r.after1, 1, 'the first dance counts');
    await g.step(20);
    const r2 = await g.eval(() => { const G = window.__G, P = G.P, T = window.__GTRL; P.mp = 1e6; P.acd = 0; window.__GSS2.cast('link'); return { done: !T.R, fus: !!(G.S.fus && G.S.fus.lkill), gr: (G.S.pgTr || {}).lkill }; });
    assert.deepEqual([r2.done, r2.fus], [true, true], 'the trial done, and the fusion learned');
    assert.match(r2.gr, /^[SABC]$/, 'a grade kept: ' + r2.gr);
    // a known fusion is practice; the wrong dance ends it
    const r3 = await g.eval(() => { const G = window.__G, P = G.P, T = window.__GTRL; const q = T.list().find((x) => x.f === 'lkill'); const pr = !!q && !q.nw; T.start(q); P.mp = 1e6; P.acd = 0; window.__GSS2.cast('wave'); return { pr, over: !T.R }; });
    assert.deepEqual([r3.pr, r3.over], [true, true], 'practice, and a wrong dance ends it');
    // too slow
    await g.eval(() => { const T = window.__GTRL; T.start(T.list().find((x) => x.f === 'lkill')); });
    await g.step(150);
    assert.equal(await g.eval(() => window.__GTRL.R), null, 'more than 2 s: the trial is lost');
    const ts = await g.eval(() => window.__GDB.log());   // the message log: the toasts on screen are a handful, and the skills learned push these off
    assert.match(ts, /Wrong dance: the mural called/); assert.match(ts, /came too late/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
