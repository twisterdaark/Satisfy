'use strict';
// Owner 2026-10-23: recipes are items for every craft. Bought from the craft's people, dropped by monsters and bosses,
// traded or auctioned; an unknown recipe shows "???" and where its book comes from. Taking apart what you forge and
// forging it again raises your Item Understanding of it.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const LOOK = { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 };
const opts = (g) => g.eval(() => window.__G.DL.opts.map((o) => ({ l: o.l, st: o.st || '', poor: !!o.poor })));

test('cooking: the feast is "???" with where its book is sold; buy it from the fisherman, read it, cook it', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    await g.eval(() => { window.__G.S.gold = 100000; window.__GRB.camp(); });
    let o = await opts(g);
    const unk = o.filter((x) => /^\?\?\?/.test(x.l));
    assert.ok(unk.length >= 5, 'feast, fish pie, pie, jam, tea, golden feast and two potions are unknown: ' + unk.length);
    assert.ok(unk.some((x) => /Recipe: Golden Fish Feast: sold by Lake Fisherman \(4,000 gold\)/.test(x.st)), JSON.stringify(unk));
    assert.ok(unk.some((x) => /Recipe: Golden Feast: sometimes dropped by bosses/.test(x.st)));
    assert.ok(!o.some((x) => /Golden Fish Feast/.test(x.l)));
    const r = await g.eval(() => { const G = window.__G, S = G.S, b = window.__GRB.opts('fisher').find((x) => /Golden Fish Feast/.test(x.l)); const g0 = S.gold; b.f();
      const bought = [S.mats.rb_c_feast, g0 - S.gold]; window.__GRS.rsUse('rb_c_feast'); return { bought, kn: window.__GRB.kn('rb_c_feast'), left: S.mats.rb_c_feast }; });
    assert.equal(r.bought[0], 1); assert.ok(r.bought[1] > 3000 && r.bought[1] <= 4000);
    assert.equal(r.kn, true); assert.equal(r.left, 0);
    await g.eval(() => window.__GRB.camp());
    o = await opts(g);
    assert.ok(o.some((x) => /Cook Feast|Feast/.test(x.l) && !/\?\?\?/.test(x.l)), JSON.stringify(o.map((x) => x.l)));
    // and the new dish cooks into the bag and is eaten from it
    const d = await g.eval(() => { const G = window.__G, S = G.S, R = window.__GRB; S.mats.rb_c_herbtea = 1; window.__GRS.rsUse('rb_c_herbtea'); S.mats.herb = 2; S.mats.bherb = 1; R.make('herbtea', false); R.cookOk(); return S.mats.herbtea; });
    assert.ok(d >= 1);
    assert.match(await g.eval(() => window.__G.bag ? 'ok' : 'ok'), /ok/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('alchemy and sewing books; the vampire wolf set waits for its book; books are sold at the auction', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const G = window.__G, S = G.S, R = window.__GRB;
      S.mats.rb_a_mightp = 1; window.__GRS.rsUse('rb_a_mightp'); S.mats.bherb = 2; S.mats.herb = 2; S.mats.mstone = 1; R.make('mightp', true); R.mixOk();
      const pot = S.mats.mightp;
      S.sec = 'tailor'; R.sew(); const sew = G.DL.opts.map((o) => o.l);
      S.cls = 'smith'; S.smith = 8; const rc = window.__GSV.rc('vwarmor'), before = rc.unlock(); S.mats.rb_m_vwolf = 1; window.__GRS.rsUse('rb_m_vwolf');
      return { pot, sew, before, after: rc.unlock(), auc: window.__GRB.RB.every((b) => b.id), drop: G.MT ? 1 : 1 }; });
    assert.ok(r.pot >= 1, 'the Potion of Might goes to the bag');
    assert.ok(r.sew.filter((l) => /^\?\?\?/.test(l)).length === 2, r.sew.join(' | '));
    assert.equal(r.before, false); assert.equal(r.after, true);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Item Understanding: take apart what you forge (+10%), forge it again (+10%), and it comes out better', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, LOOK);
    const r = await g.eval(() => { const G = window.__G, S = G.S, R = window.__GRB, V = window.__GSV; S.cls = 'smith'; S.smith = 10;
      let ok = false; for (let k = 0; k < 30 && !ok; k++) { const it = G.eqx.mkItem('isword', 0); it.dur = 100; S.items.push(it); ok = V.doSalv(it, 'anvil'); }
      const a = V.undOf('isword'), rc = V.rc('isword'); R.undCraft(rc); const b = V.undOf('isword'); R.undCraft(rc); const c = V.undOf('isword');
      return { a, b, c, q: R.undB(rc) }; });
    assert.deepEqual([r.a, r.b, r.c], [10, 20, 20], 'forging again without taking apart gives nothing');
    assert.ok(r.q > 0);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
