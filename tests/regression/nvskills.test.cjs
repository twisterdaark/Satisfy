'use strict';
// The novel's own skills where the game had stand-ins (legends/audit-*.md): Magic Missile seeks and hits; Berserk grows with
// the health lost and Sword Frenzy strikes nine times; Guardian's Power and Goddess' Protection void one blow; Guard of Steel
// takes 30% off; Tzudan keeps his warrior arts and the footprints of light make the next blow true damage; a party revive
// lifts the dead, from the Goddess' Agent or the Saintess only.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('novel skills: missile, berserk, frenzy, guardian, five steps, revive', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const r = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, N = window.__GNV, out = {};
      P.inv = 1e9; const mon = () => { const m = G.mons().find((q) => !q.dead && !window.__GCP.boss(q.type)); for (const o of G.mons()) if (o !== m && Math.hypot(o.x - P.x, o.y - P.y) < 300) { o.dead = true; o.rt = 1e9; } m.x = P.x + 40; m.y = P.y; m.hp = m.max = 1e7; P.dir = 2; P.mp = 1e6; return m; };
      // Magic Missile flies to the foe
      S.cls = 'mage'; S.lv = 30; S.sk = {}; G.isk.checkSkills(); out.mmis = !!S.sk.mmis;
      let m = mon(); window.__GSKF.cast('mmis'); for (let i = 0; i < 40; i++) N.tick(1 / 60); out.mis = m.hp < 1e7;
      // Berserk by the health lost
      S.cls = 'berserker'; S.lv = 30; S.sk = {}; G.isk.checkSkills(); out.bz = !!S.sk.bsfrenzy;
      P.hp = G.maxHP(); out.h0 = N.c2(100, m); P.hp = Math.round(G.maxHP() * .15);
      m = mon(); window.__GSKF.cast('bsfrenzy'); out.eye = N.NV.eye > 0;
      // Guardian's Power voids one blow and stuns; Guard of Steel takes 30% off
      S.cls = 'gknight'; S.lv = 30; S.sk = {}; G.isk.checkSkills(); out.gk = ['gkthrow', 'gkpow', 'gkrdr'].every((k) => S.sk[k]);
      m = mon(); window.__GSKF.cast('gkpow'); out.void1 = N.block(m); out.void2 = N.block(m); out.stun = m.stun > 0;
      P.fort = 0; const a = N.hurt(1000, m); P.fort = 5; const b = N.hurt(1000, m); P.fort = 0; out.steel = b / a;
      m = mon(); m.x = P.x + 30; window.__GSKF.cast('gkthrow'); for (let i = 0; i < 30; i++) N.tick(1 / 60); out.thrown = m.hp < 1e7;
      // Tzudan: warrior arts kept, and five footprints in a row make the next blow true damage
      S.cls = 'tzudan'; S.lv = 30; S.sk = {}; G.isk.checkSkills(); out.tz = ['tzcleave', 'whirl', 'tzfive'].every((k) => S.sk[k]);
      P.tz5 = 0; N.NV.tzC = 0; for (let i = 0; i < 5; i++) { N.NV.tzF = null; N.tick(1 / 60); const F = N.NV.tzF; if (!F) break; P.x = F.x; P.y = F.y; N.tick(1 / 60); } out.tz5 = P.tz5;
      return out; });
    await g.step(30);
    assert.equal(r.mmis, true); assert.equal(r.mis, true, 'Magic Missile hits');
    assert.equal(r.bz, true); assert.equal(r.h0, 110, 'a berserker takes 10% more'); assert.equal(r.eye, true, 'the eyes turn red');
    assert.equal(r.gk, true); assert.equal(r.void1, true); assert.equal(r.void2, false, 'only once'); assert.equal(r.stun, true);
    assert.ok(Math.abs(r.steel - 0.7) < 0.01, 'Guard of Steel: ' + r.steel); assert.equal(r.thrown, true, 'Shield Throw hits');
    assert.equal(r.tz, true, 'Tzudan keeps the warrior arts'); assert.equal(r.tz5, 2, 'five footprints: true damage');
    // the revive: only from the Goddess' Agent or the Saintess, only when dead, once in 30 s a sender
    const v = await g.eval(() => { const G = window.__G, P = G.P, N = window.__GNV, out = {};
      G.S.cls = 'warrior'; G.die();
      out.wrong = N.msg('priest', 1, 1000, 'u1'); out.ok = N.msg('gagent', 1, 1000, 'u1'); out.hp = P.hp === G.maxHP();
      out.breath0 = N.msg('saintess', 2, 700, 'u2'); P.hp = 1; out.breath = N.msg('gagent', 2, 700, 'u3') && P.hp > 1;
      return out; });
    assert.equal(v.wrong, false, 'a priest cannot raise the dead'); assert.equal(v.ok, true, 'Heart\'s Desire raises'); assert.equal(v.hp, true);
    assert.equal(v.breath0, false); assert.equal(v.breath, true, 'Goddess\' Breath reaches the party');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
