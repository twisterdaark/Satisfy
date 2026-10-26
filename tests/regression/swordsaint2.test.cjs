'use strict';
// v3.13 The Sword Saint's new arts (the owner 2026-10-26, his own design): Body as a Blade, Transcendent Sword Mastery,
// Pinnacle Counter, Kill Peak, Conqueror of the Mind (Sword Field), Shadowless Thousand Sword Storm.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the passives, the counter, the peak, the field and the storm', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, X = window.__GSS2, o = {};
      const def0 = G.isk && G.isk.defV ? G.isk.defV() : null;
      S.cls = 'saint'; S.lv = 200; S.sk = {}; G.isk.checkSkills();
      o.has = ['ssblade', 'sstsm', 'sspc', 'sskp', 'ssfield', 'ssstorm'].map((k) => !!S.sk[k]);
      o.bl = X.bl(); o.as = X.as();
      // a foe in front, and nothing else near
      const m = G.mons().find((q) => !q.dead && !G.isk.MT[q.type].boss); for (const q of G.mons()) if (q !== m && Math.hypot(q.x - P.x, q.y - P.y) < 400) { q.dead = true; q.rt = 1e9; }
      m.x = P.x + 30; m.y = P.y; m.hp = m.max = 1e9; P.dir = 2; P.mp = 1e6;
      // Pinnacle Counter: the blow does nothing, the attacker is cut and stunned
      X.cast('sspc'); o.tick = X.hurt(5, null) > 0; P.inv = 0;   // (review) a blow with no monster behind it doesn't spend it
      const hp0 = P.hp, mh0 = m.hp; const got = X.hurt(500, m); o.pc = [got, P.hp === hp0, m.hp < mh0, m.stun > 1];
      P.inv = 0; o.pc2 = X.hurt(5, m) > 0;   // only the first blow
      // Kill Peak: 0.8 s later a line of fixed damage, then the Cleft: no healing
      m.stun = 0; m.wardT = 1e9; m.wardR = .4; const h1 = m.hp; X.cast('sskp'); X.tick(.5); o.kp0 = m.hp === h1; X.tick(.4); o.kp = h1 - m.hp; o.cleft = m.cleftU > 0 && m.wardT === 0;
      const hc = m.hp; m.hp += 5000; X.tick(.1); o.noHeal = m.hp === hc;
      // the Sword Field
      X.cast('ssfield'); X.tick(.05); o.fd = [m.sfU > 0, P.ssFU > 0];
      // the Storm needs Control Sword's swords
      P.ctlU = 0; P.ctlS = null; P.cd = {}; P.mp = 1e6; X.cast('ssstorm'); o.st0 = !P.ssSt;
      window.__GSKF.cast('sctl'); P.cd = {}; X.cast('ssstorm'); const h2 = m.hp; for (let i = 0; i < 40; i++) X.tick(.1); o.st = [h2 > m.hp, Math.round(m.shred * 100)];
      // Transcendent Sword Mastery: every fifth strike in a row
      X.N.n = 0; X.N.t = -9; const h3 = m.hp; for (let i = 0; i < 4; i++) X.strike(); o.sw4 = m.hp === h3; X.strike(); o.sw5 = m.hp < h3;
      return o;
    });
    assert.deepEqual(r.has, [true, true, true, true, true, true]);
    assert.equal(r.bl, 0.15); assert.equal(r.as, 2);
    assert.equal(r.tick, true); assert.deepEqual(r.pc, [0, true, true, true]); assert.equal(r.pc2, true);
    assert.equal(r.kp0, true); assert.ok(r.kp > 0, 'Kill Peak hits'); assert.equal(r.cleft, true); assert.equal(r.noHeal, true);
    assert.deepEqual(r.fd, [true, true]);
    assert.equal(r.st0, true, 'no storm without Control Sword');
    assert.deepEqual(r.st, [true, 100]);
    assert.equal(r.sw4, true); assert.equal(r.sw5, true);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Swordsmanship Creation: a technique of your own from six factors, as many as Complete Sword Mastery\'s level', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, W = window.__GSWC, X = window.__GSS2, o = {};
      S.cls = 'saint'; S.lv = 200; S.sk = {}; G.isk.checkSkills(); o.has = [!!S.sk.sscre, !!S.sk.sscsm]; o.max = W.max();
      W.open(); o.open = !document.getElementById('swcW').hidden;
      document.querySelector('#swcW [data-swpre="split"]').click(); o.nm = document.getElementById('swcNm').value;
      const set = (i, v) => { const e = document.querySelector('#swcW [data-swf="' + i + '"]'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
      set(0, 10); o.capped = W.W.f[0];   // the points left cap it
      set(1, 7); const sl = document.querySelector('#swcW [data-swf="0"]'); sl.value = 10; sl.dispatchEvent(new Event('input', { bubbles: true })); o.f = W.W.f.slice(); o.sum = o.f.reduce((a, b) => a + b, 0);
      document.getElementById('swcNm').value = '<img src=x>Sky'; W.done(); document.getElementById('cfmY').click(); o.n = (S.swc || []).length; const c = S.swc[0], id = 'swc_' + c.id;
      o.skd = !!G.isk.MT && !!window.__G.defs().SKD[id]; o.learned = !!S.sk[id]; o.name = window.__G.lines().en['sk_' + id];
      // it cuts a foe ahead with a sword
      const m = G.mons().find((q) => !q.dead && !G.isk.MT[q.type].boss); for (const q of G.mons()) if (q !== m && Math.hypot(q.x - P.x, q.y - P.y) < 400) { q.dead = true; q.rt = 1e9; }
      m.x = P.x + 40; m.y = P.y; m.hp = m.max = 1e9; P.dir = 2; P.mp = 1e6; P.cd = {}; const h = m.hp; X.cast(id); o.hit = m.hp < h;
      // full: one use at Complete Sword Mastery 1
      W.open(); o.full = document.getElementById('swcW').hidden;
      // another character has none of it
      S.swc = []; W.reg(); o.gone = !window.__G.defs().SKD[id];
      S.cls = 'knight'; o.max0 = W.max();
      return o;
    });
    assert.deepEqual(r.has, [true, true]); assert.equal(r.max, 1); assert.equal(r.open, true);
    assert.equal(r.nm, 'Splitting the Sky'); assert.equal(r.capped, 8, 'thirty points: the slider stops at what is left'); assert.equal(r.sum, 30, 'thirty points at most: ' + JSON.stringify(r.f)); assert.equal(r.f[0], 10);
    assert.equal(r.n, 1); assert.equal(r.skd, true); assert.equal(r.learned, true); assert.equal(r.name, 'img src=xSky', 'no markup in a name');
    assert.equal(r.hit, true); assert.equal(r.full, true); assert.equal(r.gone, true); assert.equal(r.max0, 0);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
