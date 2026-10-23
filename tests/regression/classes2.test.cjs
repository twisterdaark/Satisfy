'use strict';
// Tier-2 classes (major 6): Knight, Berserker, Lancer and Ranger come from a trainer's trial for one who has the base class,
// level 20 and the weapon mastery; the new class keeps the old skills; each class's mechanics work against monsters.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the Berserker trial: class, level and mastery gate it, one path only, the class keeps the Warrior skills', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const a = await g.eval(() => { const G = window.__G, C = window.__GC2; G.S.cls = 'warrior'; G.S.lv = 20; G.S.mast = { sword: 0 };
      return { b: C.avail('c2b'), l: C.avail('c2l'), r: C.avail('c2r'), k: C.avail('c2k'), mst: C.mstOk({ mst: ['melee', 3] }) }; });
    assert.deepEqual(a, { b: true, l: true, r: false, k: true, mst: false });
    // the trainer offers both paths; a locked one says what it needs
    assert.equal(await g.eval(() => window.__GC2.talk('tw')), true);
    const opts = await g.eval(() => [...document.querySelectorAll('#dialog button')].map((b) => b.textContent));
    assert.ok(opts.some((o) => /Berserker/.test(o) && /🔒/.test(o)) && opts.some((o) => /Spear Knight/.test(o)), opts.join(' | '));
    await g.eval(() => { window.__G.S.mast.sword = 200; window.__GC2.accept('c2b'); });
    assert.equal(await g.eval(() => window.__GC2.avail('c2l')), false, 'one path at a time');
    // only kills below half health count
    const c = await g.eval(() => { const G = window.__G, C = window.__GC2; G.P.hp = G.maxHP(); C.ev('kill', 'merman'); const full = G.S.qs.c2b.c || 0; G.P.hp = 1; C.ev('kill', 'merman'); return [full, G.S.qs.c2b.c, C.obj('c2b')]; });
    assert.deepEqual(c.slice(0, 2), [0, 1]);
    assert.match(c[2], /below 50% health/);
    const done = await g.eval(() => { const G = window.__G, C = window.__GC2; G.S.qs.c2b.c = 12; C.complete('c2b'); return { cls: G.S.cls, base: G.S.cbase, sk: C.cls(), pas: C.pas() }; });
    assert.equal(done.cls, 'berserker'); assert.equal(done.base, 'warrior');
    assert.ok(done.sk.includes('whirl') && done.sk.includes('cleave'), done.sk.join());
    assert.ok(done.pas.includes('bfury'));
    // Berserk (the novel's, ch131): every hit drinks a little health back; and Last Stand keeps you up against monsters
    const f = await g.eval(() => { const G = window.__G, C = window.__GC2; const m = G.spawnMon('wolf', G.P.x + 20, G.P.y); m.max = m.hp = 1e7; G.P.hp = Math.round(G.maxHP() / 2); const h0 = G.P.hp; C.hit(m); C.hit(m);
      const drank = G.P.hp > h0; G.P.lst = 6; G.P.lstOn = 1; G.P.inv = 0; G.P.dash = 0; C.hurt(1e7, m); return { drank, hp: G.P.hp }; });
    assert.equal(f.drank, true); assert.equal(f.hp, 1);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Knight stance, Lancer corridor, Ranger trap and track', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    // Knight: a blow from the front does far less than one from behind
    const k = await g.eval(() => { const G = window.__G, C = window.__GC2, P = G.P; G.S.cls = 'knight'; G.S.lv = 30; P.kst = 8; P.dir = 2; P.guard = 0; const out = [];
      for (const dx of [20, -20]) { P.hp = G.maxHP(); P.inv = 0; P.dash = 0; const h0 = P.hp; C.hurt(40, { x: P.x + dx, y: P.y, type: 'wolf' }); out.push(h0 - P.hp); }
      P.kst = 0; P.glk = 3; return { front: out[0], back: out[1], st: C.st() }; });
    assert.ok(k.front < k.back * 0.5, JSON.stringify(k));
    assert.equal(k.st, 'g', 'Guard Link rides in the presence fx');
    // Lancer: the thrust line stops at the first wall
    const l = await g.eval(() => { const G = window.__G, C = window.__GC2, P = G.P, TS = 16;
      for (let ty = 60; ty < 100; ty++) for (let tx = 100; tx < 170; tx++) if (C.solid(tx, ty) && !C.solid(tx - 1, ty) && !C.solid(tx - 2, ty) && !C.solid(tx - 3, ty) && !C.solid(tx - 4, ty)) {
        P.x = (tx - 3) * TS + 8; P.y = ty * TS + 3 + 8; return { d: C.line([1, 0], 70), open: C.line([-1, 0], 30) }; }
      return null; });
    assert.ok(l && l.d < 40 && l.d >= 20, JSON.stringify(l));
    // Ranger: the trap holds the first monster on it; Track marks the strongest
    const r = await g.eval(() => { const G = window.__G, C = window.__GC2, P = G.P; G.S.cls = 'ranger'; G.S.lv = 30;
      C.sk('trap'); const n = C.C2.traps.length; const m = G.spawnMon('wolf', P.x, P.y); m.max = m.hp = 1e6; m.stun = 0; C.tick(0.05);
      const held = m.stun > 1, left = C.C2.traps.length;
      const big = G.spawnMon('wolf', P.x + 60, P.y); big.lv = 999; C.sk('track');
      return { n, held, left, marked: big.mk > 0, tracked: C.C2.trkL.length > 1 }; });
    assert.deepEqual(r, { n: 1, held: true, left: 0, marked: true, tracked: true });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
