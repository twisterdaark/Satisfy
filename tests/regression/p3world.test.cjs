'use strict';
// Owner 2026-10-21, patch 3 of the third batch: the elementals and the Storm Temple (plan U125-U127, U179), wyverns, drakes
// and the wyvern nest (U128, U129, U180), the Vampire City, its catacombs, thralls and lord, and the Covenant (U132, U133,
// U160, U176, U349).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const at = (g, x, y) => g.eval(([x, y]) => { const G = window.__G; G.P.x = x * 16 + 8; G.P.y = y * 16 + 8; G.P.inv = 1e9; G.P.hp = 1e9; }, [x, y]);

test('the three places are on the map with their monsters and bosses, and the new sheets are made', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => {
      const G = window.__G, X = window.__GP3, z = (x, y) => X.zone(x, y), n = {};
      for (const m of G.mons()) n[m.type] = (n[m.type] || 0) + 1;
      return { z: [z(85, 212), z(240, 216), z(640, 212), z(700, 222), z(300, 212)], n, sh: ['wyvern', 'drake', 'wqueen'].map((k) => +X.sheet(k).scale.toFixed(2)),
        envoy: G.npcs.some((p) => p.id === 'vcenv') };
    });
    assert.deepEqual(r.z, ['zStorm', 'zWyvern', 'zVamp', 'zCata', null]);
    for (const k of ['felem', 'ielem', 'selem', 'wyvern', 'drake', 'vthrall', 'vknight']) assert.ok(r.n[k] >= 8, k + ' ' + r.n[k]);
    for (const k of ['slord', 'wqueen', 'vlord']) assert.equal(r.n[k], 1, k);
    assert.deepEqual(r.sh, [0.42, 1.69, 0.68]);
    assert.ok(r.envoy);
    // a walk through each place draws without errors
    for (const [x, y] of [[88, 214], [240, 208], [642, 212], [702, 222]]) { await at(g, x, y); await g.step(20); }
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the Storm Lord takes a tenth until all four rods are grounded; grounding needs you to stand still; lightning strikes in the temple but not beside a grounded rod', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await at(g, 75, 206);
    const L = () => g.eval(() => window.__GP3.atk(window.__G.mons().find((m) => m.type === 'slord')));
    assert.equal(await L(), 0.1);
    await g.eval(() => { const X = window.__GP3; X.P3.sT = 99; X.act({ k: 'p3rod', i: 0 }); });
    await g.step(20);
    await g.page.keyboard.down('KeyD'); await g.step(6); await g.page.keyboard.up('KeyD');
    assert.equal(await g.eval(() => window.__GP3.P3.ch), null, 'moving breaks it');
    await g.step(15);
    await g.eval(() => { window.__GP3.P3.sT = 99; window.__GP3.act({ k: 'p3rod', i: 0 }); });
    await g.step(140);
    assert.deepEqual(await g.eval(() => window.__GP3.P3.rod), [1, 0, 0, 0]);
    // a strike near the grounded rod goes into the rod
    await g.eval(() => { const X = window.__GP3, G = window.__G, p = X.STT.rods[0]; G.P.x = p[0] * 16 + 8; G.P.y = p[1] * 16 + 20; X.P3.strike.length = 0; X.P3.sT = 0; });
    await g.step(2);
    assert.equal(await g.eval(() => window.__GP3.P3.strike[0].rod), 0);
    // a strike where you stand hurts
    const hp = await g.eval(() => { const G = window.__G, X = window.__GP3; G.P.inv = 0; G.P.x = 88 * 16; G.P.y = 214 * 16; X.P3.sT = 99; X.P3.strike.length = 0; X.P3.strike.push({ x: G.P.x, y: G.P.y, t: .05, rod: -1, ft: .2 }); return G.P.hp; });
    await g.step(10);
    assert.ok(await g.eval(() => window.__G.P.hp) < hp, 'the bolt hurt');
    await g.eval(() => { window.__G.P.inv = 1e9; window.__GP3.P3.rod = [1, 1, 1, 1]; });
    assert.equal(await L(), 1);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('taking a wyvern egg gives one, hides it for you, and sets the nest on you', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await at(g, 238, 214);
    const r = await g.eval(() => {
      const G = window.__G, X = window.__GP3, o = { k: 'p3egg', i: 0, x: X.WYN.eggs[0][0] * 16 + 8, y: X.WYN.eggs[0][1] * 16 + 10 }, q = G.mons().find((m) => m.type === 'wqueen');
      q.agg = 0; q.eng = 0; const before = X.vis(o); X.act(o); return [before, X.vis(o), G.S.mats.wegg, !!q.agg];
    });
    assert.deepEqual(r, [true, false, 1, true]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('vampires heal on what they hit; the Covenant takes you after the envoy\'s quests, softens vampires and gives health back on your hits', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(() => window.__GVP.force(22)); // owner 2026-10-22: the thralls hide indoors by day, so this runs at night, when they hit 15% harder
    await at(g, 640, 212);
    await g.step(40);
    const r = await g.eval(() => {
      const G = window.__G, X = window.__GP3, C = window.__GC2, m = G.mons().find((v) => v.type === 'vthrall'); m.hp = m.max - 5000;
      const plain = X.hurt(1000, m), healed = m.max - m.hp;
      G.S.lv = 270; C.accept('vc1'); G.S.qs.vc1.c = 30; C.complete('vc1'); C.accept('vc2'); G.S.mats.bvial = 10; C.complete('vc2'); X.tick(1 / 60);
      const cov = G.S.p3.cov, soft = X.hurt(1000, m); G.P.hp = 100; X.P3.ls = 0; X.hit(m, 10000); const back = G.P.hp - 100;
      return { plain, healed, cov, soft, back, want: Math.min(300, window.__GP3.mh() * .02), bv: G.S.mats.bvial, env: X.env().length };
    });
    assert.equal(r.plain, 1150);
    assert.equal(r.healed, 3850, 'the thrall drank 1150');
    assert.equal(r.cov, 1);
    assert.equal(r.soft, 978);
    assert.ok(Math.abs(r.back - r.want) < 1e-6, '3% of 10000 comes back, at most 2% of your health: ' + JSON.stringify(r));
    assert.equal(r.bv, 0, 'the vials were taken');
    assert.equal(r.env, 1, 'the envoy offers to leave');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
