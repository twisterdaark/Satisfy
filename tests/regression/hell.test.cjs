'use strict';
// Cork Island's dungeon, Hell Gao, Noe's egg and hell (owner 2026-10-26, v3.31): the floors and the hells are places of their
// own; Hell Gao's seams give only while he is up; his fall pays the fire stone and the egg; the egg hatches on a human soul
// into Noe with the title and demonic power; hell's gate wants a Demon Slayer, 100 demonic power or level 450; inside, ch
// 425's penalties, lifted at 400 demonic power, and death with 400 takes you to hell's village.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('Cork Island dungeon, Hell Gao, the egg and hell', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const a = await g.eval(() => { const G = window.__G, X = window.__GHELL, TS = 16;
      const z = (x, y) => G.zoneAt(x * TS + 8, y * TS + 8);
      const floors = X.CORKD.F.map((F) => z(F.x0 + 6, F.cy)), hells = X.HELL.C.map((C) => z(C.x0 + 6, X.HELL.cy));
      const kinds = ['hellgao', 'hkeep', 'dbeast', 'marcho', 'leraje'].map((k) => G.mons().filter((m) => m.type === k).length);
      return { floors, hells, kinds, missing: window.__GMON.missing() }; });
    assert.deepEqual(a.floors, ['zCorkD1', 'zCorkD2', 'zCorkD3', 'zCorkD4']);
    assert.deepEqual(a.hells, ['zHellV', 'zHell30', 'zHell29', 'zHell25', 'zHell10', 'zHell9']);
    assert.deepEqual(a.kinds.map((n) => n > 0), [true, true, true, true, true], JSON.stringify(a.kinds));
    assert.deepEqual(a.missing, [], 'every new monster has a look');
    // the fourth floor: no seam before he rises; once up, a seam gives a fire stone (the dice say yes) and only once
    const b = await g.eval(() => { const G = window.__G, X = window.__GHELL, S = G.S, P = G.P, m = X.of(), F = X.CORKD.F[3], v = X.HGV[0];
      P.x = v.x; P.y = v.y + (v.up ? 14 : -14); S.zone = 'zCorkD4'; m.dead = true; m.hgA = 0;
      const before = X.near().length; m.dead = false; m.hp = m.max; X.tick(0.016);
      X.rnd(() => 0); const near = X.near().length; X.vein(v); const fs1 = S.mats.fstone | 0; X.vein(v); const fs2 = S.mats.fstone | 0;
      P.x = m.x - 120; P.y = m.y; X.tick(0.016); return { inside: X.inCork(), before, near, fs1, fs2, up: X.up(), deb: P.hgDeb > 0 }; });
    assert.equal(b.inside, true); assert.equal(b.before, 0, 'no seam while he is down'); assert.ok(b.near >= 1);
    assert.equal(b.fs1, 1); assert.equal(b.fs2, 1, 'a seam gives once per appearance'); assert.equal(b.deb, true, 'his roar debilitates');
    // his fall: whoever dealt 3% gets a fire stone and, by the dice, Memphis' Egg; a human soul hatches it
    const c = await g.eval(() => { const G = window.__G, X = window.__GHELL, S = G.S, m = X.of();
      X.rnd(() => 0); m.hgMy = m.max * 0.1; X.down(m); const egg = S.mats.megg | 0, fs = S.mats.fstone | 0;
      const human = X.human({ type: 'outlaw' }), demon = X.human({ type: 'succ' });
      X.soul(); const noe = !!(S.pets || {}).noe, tl = !!S.tl.thell, dp0 = S.hid.dpow;
      S.pet = 'noe'; X.soul(); X.soul();
      return { egg, fs, human, demon, noe, tl, dp0, dp: S.hid.dpow, eggLeft: S.mats.megg | 0, wb: (window.__G.S && 1) }; });
    assert.equal(c.egg, 1); assert.equal(c.fs, 2); assert.equal(c.human, true); assert.equal(c.demon, false);
    assert.equal(c.noe, true); assert.equal(c.tl, true); assert.equal(c.dp0, 0); assert.equal(c.eggLeft, 0);
    assert.equal(c.dp, 2, 'with Noe out each human soul is one demonic power');
    // a named drop is always a piece of gear: a material there (the fire stone was) threw on Hell Gao's fall (owner 2026-10-26)
    const bad = await g.eval(() => { const X = window.__G.eqx, N = window.__GUND.NDROP, L = [];
      for (const [k, d] of Object.entries(N)) for (const [id] of d) { try { X.mkItem(id, 0); } catch (e) { L.push(k + ':' + id); } }
      return L; });
    assert.deepEqual(bad, []);
    // hell's gate, its penalties, and the fall
    const d = await g.eval(() => { const G = window.__G, X = window.__GHELL, S = G.S, P = G.P;
      S.lv = 100; S.cls = 'knight'; const shut = X.gate(); S.hid.dpow = 120; const open = X.gate(); S.hid.dpow = 0; S.cls = 'dslayer'; const ds = X.gate(); S.cls = 'knight';
      const C = X.HELL.C[1]; P.x = (C.x0 + 20) * 16 + 8; P.y = X.HELL.cy * 16 + 10; S.zone = 'zHell30';
      const inHell = X.z(), deb = X.deb(); S.hid.dpow = 400; const deb400 = X.deb(); S.hid.dpow = 0;
      const V = X.HELL.C[0]; P.x = (V.x0 + 20) * 16 + 8; S.zone = 'zHellV'; const vill = X.z();
      S.hid.dpow = 400; P.x = 1000; P.y = 1000; const fell = X.fall(); const at = G.zoneAt(P.x, P.y); S.hid.dpow = 0; const no = X.fall();
      return { shut, open, ds, inHell, deb, deb400, vill, fell, at, no }; });
    assert.deepEqual([d.shut, d.open, d.ds], [false, true, true]);
    assert.deepEqual([d.inHell, d.deb, d.deb400, d.vill], [true, true, false, false]);
    assert.deepEqual([d.fell, d.at, d.no], [true, 'zHellV', false]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
