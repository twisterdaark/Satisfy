'use strict';
// v3.16 Elemental resistance as in the novel (the owner 2026-10-26): monsters resist their own attribute and fear the one
// that beats it, the undead and demons resist darkness and fear holy power; skills carry an attribute; the Sword Saint's
// Body as a Blade ignores half of it under 30% health; a monster's defence, and the Condemnation Sword that hits with it.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('resistances, attributes, Body as a Blade and the Condemnation Sword', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, E = window.__GEL, o = {};
      o.res = [E.res('felem', 'fire'), E.res('felem', 'water'), E.res('salamander', 'fire'), E.res('skel', 'holy'), E.res('skel', 'poison'), E.res('belial', 'dark'), E.res('pwolf', 'fire'), E.res('pwolf', null)];
      o.el = [E.el('fireball'), E.el('bolt'), E.el('imprison'), E.el('skslash'), E.el('dsdest'), E.el('kill'), E.el('strike'), E.el('whirl'), E.el('fmshield'), E.el('plight')];
      o.line = E.line('felem'); o.def = E.def('pwolf');
      // a fire blow on the Fire Elemental against the same on a wolf: a fifth
      for (const q of G.mons()) { q.dead = true; q.rt = 1e9; }
      const mk = (type) => { const m = G.spawnMon(type, P.x + 30, P.y); m.max = m.hp = 1e12; m.lv = S.lv; return m; };
      const avg = (m, opt) => { let d = 0; for (let i = 0; i < 60; i++) { const h = m.hp; window.__GU.hitMon(m, 1, opt); d += h - m.hp; m.hp = m.max; } return d / 60; };
      const fe = mk('felem'), wo = mk('pwolf');
      o.fire = avg(fe, { el: 'fire' }) / avg(wo, { el: 'fire' });
      o.water = avg(fe, { el: 'water' }) / avg(fe, {});
      // Body as a Blade: a Sword Saint under 30% health, a sword: half of the resistance
      S.cls = 'saint'; S.lv = 200; S.sk = {}; G.isk.checkSkills(); fe.lv = wo.lv = 200; P.hp = Math.round(G.maxHP() * 0.2);
      o.blade = avg(fe, { el: 'fire' }) / avg(wo, { el: 'fire' });
      P.hp = G.maxHP();
      // the Condemnation Sword: learned at 250, and a foe with a high defence takes more from it
      S.lv = 260; S.sk = {}; G.isk.checkSkills(); o.cond = !!S.sk.sscond;
      const T = G.isk.MT[wo.type]; const def0 = T.def; fe.dead = true;
      const cut = () => { let d = 0; for (let i = 0; i < 20; i++) { P.cd = {}; P.mp = 1e6; P.dir = 2; wo.x = P.x + 30; wo.y = P.y; wo.hp = wo.max; window.__GSKF.cast('sscond'); d += wo.max - wo.hp; } return d / 20; };
      T.def = 0; const c0 = cut(); T.def = 2000; const c1 = cut(); T.def = def0; o.condUp = c1 > c0 * 1.5;
      return o;
    });
    assert.deepEqual(r.res, [0.6, -0.3, 0.5, -0.3, 0, 0.3, 0, 0]);
    assert.deepEqual(r.el, ['fire', 'thunder', 'water', 'holy', null, null, null, null, null, null], 'a buff, Whirlwind and Holy Light (already double on the undead) carry none');
    assert.match(r.line, /Defence [\d,]+ · Resists: Fire 60% · Weak to: Water \+30%/);
    assert.ok(r.def > 0, 'a defence');
    assert.ok(r.fire > 0.33 && r.fire < 0.47, 'a fire elemental takes 40% of fire: ' + r.fire);
    assert.ok(r.water > 1.15 && r.water < 1.45, 'and 30% more from water: ' + r.water);
    assert.ok(r.blade > 0.62 && r.blade < 0.78, 'Body as a Blade ignores half: ' + r.blade);
    assert.equal(r.cond, true); assert.equal(r.condUp, true, "the target's defence raises the Condemnation Sword");
    // (review) a real cast: Fireball's explosion on the Fire Elemental against a wolf, through the projectile and boom()
    const fb = await g.eval(() => { const G = window.__G, S = G.S, P = G.P; S.cls = 'mage'; S.lv = 200; S.sk = {}; G.isk.checkSkills(); P.hp = G.maxHP();
      for (const q of G.mons()) { q.dead = true; q.rt = 1e9; }
      const mk = (type) => { const m = G.spawnMon(type, P.x + 40, P.y); m.max = m.hp = 1e12; m.lv = 200; m.tmp = 0; m.stun = 99; return m; };
      window.__fe = mk('felem'); window.__fe.x = P.x + 40; window.__wo = null; P.dir = 2; P.mp = 1e6; P.cd = {}; window.__GSKF.cast('fireball'); return true; });
    await g.step(40);
    const a = await g.eval(() => { const m = window.__fe; const d = m.max - m.hp; m.dead = true; const G = window.__G, P = G.P; const w = G.spawnMon('pwolf', P.x + 40, P.y); w.max = w.hp = 1e12; w.lv = 200; w.tmp = 0; w.stun = 99; window.__wo = w; P.cd = {}; P.mp = 1e6; window.__GSKF.cast('fireball'); return d; });
    await g.step(40);
    const b = await g.eval(() => window.__wo.max - window.__wo.hp);
    assert.ok(fb && a > 0 && b > 0, 'both hit: ' + a + ' ' + b); assert.ok(a / b > 0.25 && a / b < 0.6, 'a cast Fireball is resisted by the Fire Elemental: ' + (a / b));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
