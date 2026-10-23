'use strict';
// owner 2026-10-23, "the missing skills, 1:1 with the novel" (legends/beast-master.md): King of the Beasts is the giant lion
// whose roar fells the crowd (ch150), Lord of Heaven the eagle that slips the shackles (ch150), Half Man Half Beast the
// werewolf who keeps his weapon and recovers (ch117, 153); the Lion's Roar weakens (wiki); the tiger and snow leopard forms.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('Beast Master: lion roars, eagle slips the shackles, half-beast keeps the weapon, tiger rends, leopard dodges', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Toon', hair: 1, hc: 2, skin: 1, top: 3 });
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, U = window.__GU, X = window.__GHC, out = {};
      for (const m of G.mons()) { m.dead = true; m.rt = 1e9; }
      S.cls = 'beast'; S.lv = 60; P.dir = 2; P.mp = 1e6; S.sk = {}; G.isk.checkSkills();
      out.sk = ['bbear', 'bwolf', 'beagle', 'blord', 'bhalf', 'blion', 'broar', 'btiger', 'bleo'].filter((k) => S.sk[k]);
      const mk = (dx) => { const m = G.spawnMon('wolf', P.x + dx, P.y); m.eng = 4; m.max = m.hp = 1e9; return m; };
      const a = mk(30), b = mk(-40);
      X.sk('blion'); out.lion = [P.bmf, a.stun > 1, b.stun > 1, a.weak > 0, X.st().includes('L')];
      const h0 = X.mhp(); P.bmf = null; const h1 = X.mhp(); out.lionHP = h0 / h1;
      a.stun = 0; a.weak = 0; X.sk('broar'); out.roar = [a.weak >= 9, !(a.stun > 0)];
      P.bmf = null; P.stun = 2; P.slowT = 3; X.sk('beagle'); out.eagle = [P.bmf, P.stun, P.slowT];
      X.sk('beagle');
      P.hp = Math.round(X.mhp() / 2); X.sk('bhalf'); out.half = [P.bmf, P.bmH > 25, X.st().includes('H'), X.hurt(100, a)];
      const hp0 = P.hp; X.tick(1); out.regen = P.hp > hp0;
      P.bmH = 0; out.plain = X.hurt(100, a);
      X.sk('btiger'); a.bld = 0; U.hitMon(a, 1, {}); out.tiger = [P.bmf, a.bld > 0, X.spd()];
      X.sk('bleo'); let n = 0; for (let i = 0; i < 500; i++) if (X.evade(a)) n++; out.leo = [P.bmf, n / 500, X.acd()];
      X.sk('bhalf'); out.halfEnds = P.bmf;
      return out; });
    assert.deepEqual(r.sk, ['bbear', 'bwolf', 'beagle', 'blord', 'bhalf', 'blion', 'broar', 'btiger', 'bleo']);
    assert.deepEqual(r.lion, ['lion', true, true, true, true], 'the roar fells and weakens');
    assert.ok(Math.abs(r.lionHP - 1.15) < 0.02, 'lion health: ' + r.lionHP);
    assert.deepEqual(r.roar, [true, true], 'Lion\'s Roar weakens without felling');
    assert.deepEqual(r.eagle, ['eagle', 0, 0], 'Lord of Heaven slips the shackles');
    assert.equal(r.half[0], null, 'human form: the weapon stays'); assert.ok(r.half[1] && r.half[2]);
    assert.ok(r.half[3] < r.plain, 'the thick skin takes less: ' + r.half[3] + ' vs ' + r.plain); assert.ok(r.regen, 'phenomenal recovery');
    assert.deepEqual(r.tiger.slice(0, 2), ['tiger', true]); assert.ok(Math.abs(r.tiger[2] - 1.2) < 1e-9);
    assert.equal(r.leo[0], 'leopard'); assert.ok(r.leo[1] > 0.12 && r.leo[1] < 0.28, 'about a fifth dodged: ' + r.leo[1]); assert.equal(r.leo[2], 0.8);
    assert.equal(r.halfEnds, null, 'the half-beast ends the animal form');
    await g.step(30);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
