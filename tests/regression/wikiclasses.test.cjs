'use strict';
// The novel's classes the game lacked, written as class packs (src/content/classpacks.js, legends/wiki-combat-classes.md):
// all twenty are installed with their trial at a trainer, every skill casts without an error, and the new pack stats work:
// Clown's Tears dodges, Blood-Sucking heals, Heavy Blow Erosion takes a share of the foe's health, Mounted Mastery holds
// only on a mount, and Duplication casts another class's skill.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());
const IDS = ['martial', 'monk', 'qigong', 'gunman', 'rider', 'soldier', 'warcmd', 'bloodw', 'icemys', 'firemag', 'illus', 'magspear', 'crusher', 'acrobat', 'linker', 'dupl', 'qdraw', 'redflame', 'saintkn', 'gagent'];

test('wiki classes: installed with trials; every skill casts; the pack stats work', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    assert.deepEqual(await g.eval(() => window.__GCP.packs()), IDS);
    const q = await g.eval((ids) => ids.map((c) => { const Q = window.__G.QD['cp' + c]; return Q ? Q.by + ':' + Q.promo : c + ' missing'; }), IDS);
    assert.deepEqual(q.filter((x) => !/^(tw|ta|tm|tk|cassus|hood):/.test(x)), [], 'each has its trial at a trainer');
    // every class: learn its skills at a high level and cast each active one at a foe in front
    const r = await g.eval((ids) => { const G = window.__G, S = G.S, P = G.P, out = {};
      P.inv = 1e9;
      for (const c of ids) { S.cls = c; S.lv = 220; S.sk = {}; G.isk.checkSkills();
        const L = window.__GCP.sk(c), ks = L.map((x) => x[0]), got = ks.filter((k) => S.sk[k]);
        let hit = 0;
        for (const [k, pas] of L) { if (pas) continue;
          const m = G.mons().find((q) => !q.dead && !window.__GCP.boss(q.type)); for (const o of G.mons()) if (o !== m && Math.hypot(o.x - P.x, o.y - P.y) < 300) { o.dead = true; o.rt = 1e9; }
          m.x = P.x + 26; m.y = P.y; m.hp = m.max = 1e7; P.dir = 2; P.mp = 1e6; window.__GSKF.cast(k); if (m.hp < 1e7) hit++; }
        out[c] = [got.length === ks.length, ks.length, hit]; }
      return out; }, IDS);
    for (const c of IDS) assert.equal(r[c][0], true, c + ' learns every skill');
    assert.ok(Object.values(r).reduce((a, x) => a + x[1], 0) >= 80, 'about four skills each');
    await g.step(60);
    const s = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, C = window.__GCP, out = {};
      P.cpb = {}; S.cls = 'acrobat'; S.lv = 220; out.eva0 = C.stat('eva'); window.__GSKF.cast('actears'); out.eva = C.stat('eva');
      S.cls = 'bloodw'; out.ls = C.stat('ls');
      S.cls = 'crusher'; out.mhp = C.stat('mhp');
      S.cls = 'rider'; P.ride = 0; out.r0 = C.stat('atk'); P.ride = 1; out.r1 = C.stat('atk'); P.ride = 0;
      S.cls = 'gunman'; out.gun = [C.stat('atk'), C.stat('def'), C.stat('crit')];
      return out; });
    assert.equal(s.eva0, 0); assert.ok(Math.abs(s.eva - 0.6) < 1e-9, 'Clown\'s Tears');
    assert.ok(Math.abs(s.ls - 0.08) < 1e-9); assert.ok(Math.abs(s.mhp - 0.02) < 1e-9);
    assert.ok(s.r0 < 1e-9 && Math.abs(s.r1 - 0.3) < 1e-9, 'Mounted Mastery only on a mount');
    assert.deepEqual(s.gun.map((x) => Math.round(x * 100)), [25, -15, 15]);
    // the stats at work: the blood heals, the erosion bites, the dodge dodges
    const w = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, out = {};
      const m = G.mons().find((q) => !q.dead && !window.__GCP.boss(q.type)); for (const o of G.mons()) if (o !== m && Math.hypot(o.x - P.x, o.y - P.y) < 300) { o.dead = true; o.rt = 1e9; }
      const at = () => { m.x = P.x + 26; m.y = P.y; m.hp = m.max = 1e7; P.dir = 2; P.mp = 1e6; };
      S.cls = 'bloodw'; P.hp = Math.round(G.maxHP() / 2); const h0 = P.hp; at(); window.__GSKF.cast('bwblade'); out.heal = P.hp > h0;
      S.cls = 'crusher'; at(); window.__GSKF.cast('crshat'); out.ero = 1e7 - m.hp; return out; });
    assert.equal(w.heal, true, 'Blood-Sucking');
    assert.ok(w.ero >= 2e5, 'Heavy Blow Erosion took at least 2% of the most health: ' + w.ero);
    const d = await g.eval(() => { const G = window.__G, S = G.S, P = G.P; S.cls = 'acrobat'; P.inv = 0; P.dash = 0; P.cpb = { eva: { v: 0.6, until: 1e12 } };
      let n = 0; for (let i = 0; i < 400; i++) { P.hp = G.maxHP(); P.inv = 0; const h = P.hp; window.__GCP.hurt(5); if (P.hp === h) n++; } P.inv = 1e9; return n / 400; });
    assert.ok(d > 0.45 && d < 0.75, 'about 60% of the blows slip: ' + d);
    const u = await g.eval(() => { const G = window.__G, S = G.S, P = G.P; S.cls = 'dupl'; P.mp = 1e6; const n0 = window.__GSKF.fx(); window.__GSKF.cast('dpdup'); return window.__GSKF.fx() > n0 || !!document.querySelector('#toasts')?.textContent.match(/Duplicated/); });
    assert.equal(u, true, 'Duplication casts something');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
