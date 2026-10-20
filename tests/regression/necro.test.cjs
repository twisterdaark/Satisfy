'use strict';
// Necromancers (major 9, novel ch 499/543/591/666/797): the Hyena trial gathers fresh corpses; Summon Skeleton needs a body
// and keeps to a cap; skeletons fight the monsters near you; Corpse Explosion spends one and blocks summoning a while.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the Hyena trial, summoning from corpses up to the cap, skeletons that fight, Corpse Explosion', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    // no corpses before the trial; after it a kill leaves one, and walking onto it gathers it
    const a = await g.eval(() => { const G = window.__G, C = window.__GC2, X = window.__GNE, P = G.P; G.S.lv = 20;
      const m0 = G.spawnMon('wolf', P.x + 30, P.y); m0.hp = 1; C.hit(m0); const before = X.NEC.corpses.length;
      C.accept('cn'); const m = G.spawnMon('wolf', P.x + 30, P.y); m.hp = 1; m.lv = 20; C.hit(m); const after = X.NEC.corpses.length;
      P.x = X.NEC.corpses[0].x; P.y = X.NEC.corpses[0].y; X.tick(0.05); return { before, after, got: G.S.qs.cn.c, left: X.NEC.corpses.length, obj: C.obj('cn') }; });
    assert.deepEqual([a.before, a.after, a.got, a.left], [0, 1, 1, 0], JSON.stringify(a));
    assert.match(a.obj, /Gather fresh corpses/);
    const d = await g.eval(() => { const G = window.__G, C = window.__GC2; G.S.qs.cn.c = 8; C.complete('cn'); G.S.lv = 25; return { cls: G.S.cls, sk: C.cls(), pas: C.pas() }; });
    assert.equal(d.cls, 'necro');
    assert.ok(['nskel', 'ndrain', 'nexpl'].every((k) => d.sk.includes(k)) && d.pas.includes('nenh'), JSON.stringify(d));
    // Summon Skeleton: needs a body; never more than the cap
    const s = await g.eval(() => { const G = window.__G, X = window.__GNE, P = G.P; X.sk('nskel'); const none = X.NEC.min.length;
      for (let i = 0; i < 9; i++) X.NEC.corpses.push({ x: P.x + 10, y: P.y, t: 15 });
      for (let i = 0; i < 9; i++) X.sk('nskel'); return { none, n: X.NEC.min.length, cap: X.cap(), st: window.__GC2.st() }; });
    assert.equal(s.none, 0, 'no body, no skeleton');
    assert.equal(s.n, s.cap); assert.ok(s.cap >= 2 && s.cap <= 6);
    assert.match(s.st, /k/, 'others see your skeletons');
    // the skeletons walk to a monster near you and wound it
    const f = await g.eval(() => { const G = window.__G, X = window.__GNE, P = G.P; const m = G.spawnMon('wolf', P.x + 50, P.y); m.max = m.hp = 1e9; m.lv = 25; m.stun = 99;
      for (let i = 0; i < 60; i++) X.tick(0.1); return 1e9 - m.hp; });
    assert.ok(f > 0, 'skeletons dealt ' + f);
    // Corpse Explosion spends one and blocks summoning for a while
    const e = await g.eval(() => { const G = window.__G, X = window.__GNE, P = G.P; const n0 = X.NEC.min.length; X.sk('nexpl'); const n1 = X.NEC.min.length;
      X.NEC.corpses.push({ x: P.x, y: P.y, t: 15 }); X.sk('nskel'); return { n0, n1, n2: X.NEC.min.length, lock: X.NEC.lock > 0 }; });
    assert.equal(e.n1, e.n0 - 1); assert.equal(e.n2, e.n1, 'no summoning right after an explosion'); assert.ok(e.lock);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
