'use strict';
// The divine beasts' legendary sets (second ten, major 6): a blacksmith at smithing level 9 makes them from the beasts'
// breaths, always legendary. Red Phoenix: health regeneration 20% / 40%; White Tiger: three pieces, defense and health
// +10%; Black Tortoise: three pieces, attack speed +10% and status effect chance +15%; Blue Dragon: damage.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const wear = (g, ids) => g.eval((ids) => { const G = window.__G, X = G.eqx; for (const id of ids) { const it = X.mkItem(id, 0); G.S.items.push(it); X.equip(it); } }, ids);

test('made at the anvil from a breath by a blacksmith at level 9, always legendary', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const u = await g.eval(() => { const S = window.__G.S, r = window.__GSET.rc('rpbow'); S.cls = 'warrior'; S.smith = 9; const a = r.unlock(); S.cls = 'smith'; S.smith = 8; const b = r.unlock(); S.smith = 9; return [a, b, r.unlock()]; });
    assert.deepEqual(u, [false, false, true]);
    const it = await g.eval(() => { const G = window.__G, S = G.S; S.lv = 330; Object.assign(S.mats, { brphx: 3, mith: 20, wood: 10, topaz: 1 }); G.startMG('rpbow'); G.finishMG()(); const it = S.items[S.items.length - 1]; return { id: it.id, r: it.r, left: S.mats.brphx, mith: S.mats.mith }; });
    // (owner 2026-10-26) Legendary by Pagma's Successor's hands alone: a blacksmith's comes out Unique
    assert.deepEqual(it, { id: 'rpbow', r: 3, left: 1, mith: 10 });
    const pg = await g.eval(() => { const G = window.__G, S = G.S; S.cls = 'pagma'; G.startMG('rpbow'); G.finishMG()(); const it = S.items[S.items.length - 1]; return { id: it.id, r: it.r, left: S.mats.brphx }; });
    assert.deepEqual(pg, { id: 'rpbow', r: 4, left: 0 });
    // every piece is legendary and needs its own beast's breath; the recipe hint says where that comes from
    const all = await g.eval(() => { const ids = ['rpbow', 'rparmor', 'rphelm', 'rpboots', 'tgarmor', 'tghelm', 'tggloves', 'tgboots', 'dgspear', 'dggaunt', 'dgarmor', 'dghelm', 'ttthorn', 'ttshell', 'tthelm', 'ttboots'], br = { rp: 'brphx', tg: 'brtig', dg: 'brdrg', tt: 'brtor' };
      return ids.filter((id) => { const r = window.__GSET.rc(id); return !(r.fix === 4 && r.need[br[id.slice(0, 2)]] >= 1 && window.__G.eqx.mkItem(id, 0).r === 4); }); });
    assert.deepEqual(all, []);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the four set effects', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { window.__G.S.lv = 360; });
    // Red Phoenix: 2 pieces 20%, 4 pieces 40% health regeneration (a share of max health each second)
    await wear(g, ['rparmor', 'rphelm']);
    assert.equal(await g.eval(() => window.__GSET.bon('hrg')), 0.2);
    const reg = await g.eval(() => { const G = window.__G, P = G.P, m = window.__GSET.maxHP(); P.hp = Math.round(m / 2); return [P.hp, m]; });
    await g.step(60);
    const hp1 = await g.eval(() => window.__G.P.hp);
    assert.ok(hp1 > reg[0] && hp1 - reg[0] < reg[1] * 0.004, 'about 0.2% a second: ' + (hp1 - reg[0]) + ' of ' + reg[1]);
    await wear(g, ['rpboots', 'rpbow']);
    assert.equal(await g.eval(() => window.__GSET.tier('rp')), 4);
    assert.equal(await g.eval(() => window.__GSET.bon('hrg')), 0.4);
    assert.match(await g.eval(() => window.__GSET.tip(window.__G.eqx.eqIt('h'))), /Red Phoenix Set \(4\/4\)[\s\S]*Health regeneration 20%[\s\S]*Health regeneration 40%/);
    // White Tiger: three pieces, defense and health +10%
    await wear(g, ['tgarmor', 'tghelm']);
    const d2 = await g.eval(() => { const G = window.__G; return [G.eqx.defV(), window.__GSET.maxHP()]; });
    await wear(g, ['tggloves']);
    const d3 = await g.eval(() => { const G = window.__G; return [G.eqx.defV(), window.__GSET.maxHP(), window.__GSET.tier('tg')]; });
    assert.equal(d3[2], 3);
    const gd = await g.eval(() => window.__G.eqx.eqIt('g').def);
    assert.ok(Math.abs(d3[0] - (d2[0] + gd) * 1.1) <= 2, 'defense +10%: ' + d2[0] + ' + ' + gd + ' -> ' + d3[0]);
    assert.ok(d3[1] > d2[1] * 1.05, 'health up');
    assert.equal(await g.eval(() => window.__GSET.bon('dfp')), 0.1);
    // Black Tortoise: three pieces, attack speed +10% and a hit's chance to stun
    await wear(g, ['ttshell', 'tthelm', 'ttthorn']);
    assert.deepEqual(await g.eval(() => [window.__GSET.tier('tt'), window.__GSET.bon('stc'), +window.__GSET.bon('as').toFixed(3)]), [3, 0.15, 0.1]);
    const st = await g.eval(() => { const m = window.__G.mons().find((x) => x.type === 'wolf' && !x.dead); m.max = m.hp = 1e9; let n = 0; for (let i = 0; i < 400; i++) if (window.__GDS.stun(m)) n++; return n; });
    assert.ok(st > 30 && st < 95, '15% of 400 hits stun: ' + st);
    // Blue Dragon: four pieces, +12% damage and +6% attack speed
    await wear(g, ['dgspear', 'dggaunt', 'dgarmor', 'dghelm']);
    assert.deepEqual(await g.eval(() => [window.__GSET.tier('dg'), window.__GSET.bon('dm')]), [4, 0.12]);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
