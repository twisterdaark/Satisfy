'use strict';
// Equipment sets (v0.99): the Frostlight Orc Chief's set from the novel ("3 set items equipped: Strength +50, stamina
// +80"; "5 ... Strength +100, stamina +200" and "It is possible to command the frostlight orcs"), Emous' set made by a
// blacksmith (always unique) and the mass-produced Grid set (effects from two pieces up to five).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const toasts = (g) => g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | '));
// put the given pieces in the bag and wear them
const wear = (g, ids) => g.eval((ids) => { const G = window.__G, X = G.eqx; for (const id of ids) { const it = X.mkItem(id, 0); G.S.items.push(it); X.equip(it); } }, ids);

test('the Frostlight Orc Chief\'s set: three pieces, then five; the frostlight orcs leave you be', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { window.__G.S.lv = 150; });
    const s0 = await g.eval(() => [window.__GSET.stat('str'), window.__GSET.stat('sta')]);
    await wear(g, ['ochelm', 'ocarmor', 'ocgloves']);
    assert.equal(await g.eval(() => window.__GSET.tier('fo')), 3);
    const s3 = await g.eval(() => [window.__GSET.stat('str'), window.__GSET.stat('sta')]);
    assert.deepEqual([s3[0] - s0[0], s3[1] - s0[1]], [50, 80]);
    assert.match(await toasts(g), /Frostlight Orc Chief’s set: the 3-piece effect is active!/);
    assert.match(await g.eval(() => window.__GSET.tip(window.__G.eqx.eqIt('h'))), /Frostlight Orc Chief’s set \(3\/5\)[\s\S]*Strength \+50, stamina \+80[\s\S]*command the frostlight orcs/);
    // a frostlight orc right beside you still comes for you
    const near = async () => g.eval(() => { const G = window.__G, P = G.P, m = G.mons().find((m) => m.type === 'forc' && !m.dead); P.x = m.sx - 30; P.y = m.sy; m.x = m.sx; m.y = m.sy; m.eng = 0; m.ret = 0; return m.id; });
    let id = await near();
    for (let i = 0; i < 6; i++) await g.step(1);
    assert.ok(await g.eval((id) => window.__G.mons().find((m) => m.id === id).eng > 0, id));
    // five pieces: +100 / +200, and the orcs regard you as their chief
    await wear(g, ['ocboots', 'ocring']);
    await g.page.waitForTimeout(1000);
    const s5 = await g.eval(() => [window.__GSET.stat('str'), window.__GSET.stat('sta')]);
    assert.deepEqual([s5[0] - s0[0], s5[1] - s0[1]], [100, 200]);
    assert.match(await toasts(g), /The frostlight orcs regard you as their chief/);
    id = await near();
    for (let i = 0; i < 6; i++) await g.step(1);
    assert.ok((await g.eval((id) => window.__G.mons().find((m) => m.id === id).eng, id)) <= 0);
    // the chief and his orcs drop the pieces
    assert.ok(await g.eval(() => ['ocarmor', 'ocgloves', 'ocboots', 'ocring'].every((k) => window.__GSET.rc(k).drop)));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Emous\' set at a blacksmith\'s anvil, and the mass-produced Grid set from two pieces to five', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    // Emous' recipes open to a blacksmith at smithing level 8, always unique
    const u = await g.eval(() => { const G = window.__G, S = G.S, r = window.__GSET.rc('emarmor'); S.cls = 'warrior'; S.smith = 8; const a = r.unlock(); S.cls = 'smith'; return [a, r.unlock(), G.eqx.mkItem('emarmor', 0).r]; });
    assert.deepEqual(u, [false, true, 3]);
    await g.eval(() => { window.__G.S.lv = 340; });
    const d0 = await g.eval(() => [window.__G.eqx.defV(), window.__GSET.maxHP()]);
    await wear(g, ['emarmor']);
    const d1 = await g.eval(() => [window.__G.eqx.defV(), window.__GSET.maxHP(), window.__GSET.bon('def')]);
    assert.equal(d1[2], 0);
    await wear(g, ['emhelm']);
    const d2 = await g.eval(() => [window.__G.eqx.defV(), window.__GSET.maxHP(), window.__GSET.bon('def'), window.__GSET.gearSum('hpp')]);
    assert.equal(d2[2], 10);
    assert.ok(d2[0] > d1[0] + 10, JSON.stringify([d0, d1, d2]));
    assert.match(await toasts(g), /Emous’ set: the 2-piece effect is active!/);
    // the Grid set: 2, 3, 4 and 5 pieces
    const mg = await g.eval(() => { const G = window.__G, X = G.eqx, out = []; G.S.items = G.S.items.filter((i) => !/^em/.test(i.id)); G.S.eqA = null; G.S.eq = {};
      for (const id of ['mgarmor', 'mghelm', 'mggloves', 'mgboots', 'mgsword']) { const it = X.mkItem(id, 0); G.S.items.push(it); X.equip(it); out.push([window.__GSET.tier('mg'), Math.round(window.__GSET.bon('dm') * 100)]); } return out; });
    assert.deepEqual(mg, [[0, 0], [2, 4], [3, 6], [4, 8], [5, 12]]);
    assert.ok(await g.eval(() => window.__GSET.rc('mgsword').unlock.toString().includes('S.smith>=6')));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
