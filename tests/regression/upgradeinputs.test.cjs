'use strict';
// SAT-ONLINE-134 (plan U224, "rare gem exchange: socketing and paid upgrade sinks; upgrade consumes exactly inputs"). Setting
// a gem takes exactly one gem of its kind and 500 gold, a gem set over another takes its own and the old one is gone; with
// too little gold nothing is taken. An enhancement takes exactly its price (gold, magic stones, enhancement stones) whether
// it works or not, and nothing when something is short. Gems change hands between players on the online auction house
// (they are among its goods), so the rare ones have a market.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const bag = (g) => g.eval(() => { const S = window.__G.S; return { gold: S.gold, ruby: S.mats.ruby | 0, topaz: S.mats.topaz | 0, mstone: S.mats.mstone | 0, estone: S.mats.estone | 0 }; });
async function opts(g) {
  for (let i = 0; i < 4 && await g.eval(() => document.getElementById('dopts').hidden); i++) { await g.eval(() => window.__G.advance()); await g.step(2); }
  return g.eval(() => [...document.querySelectorAll('#dopts button')].map((x) => x.textContent.replace(/^\d+\.\s*/, '')));
}
// the first choice: the weapon heads the list of what you wear
const first = async (g) => { await opts(g); await g.eval(() => document.querySelector('#dopts button').click()); await g.step(2); };
const pick = async (g, re) => { await opts(g); await g.eval((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll('#dopts button')].find((x) => r.test(x.textContent)); if (!b) throw new Error('no option ' + src + ': ' + [...document.querySelectorAll('#dopts button')].map((x) => x.textContent).join(' / ')); b.click(); }, re.source); await g.step(2); };

test('upgrades take exactly their inputs: a gem and 500 gold to set one, the price of an enhancement, nothing when short', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    await g.eval(() => { const S = window.__G.S; S.gold = 2000; S.mats.ruby = 2; S.mats.topaz = 1; S.mats.mstone = 30; S.mats.estone = 30; });
    await g.eval(() => { window.__wpn = () => { const S = window.__G.S; return S.items.find((i) => i.uid === S.eqW); }; });
    assert.ok(await g.eval(() => !!window.__wpn()), 'a weapon in hand');
    const w = await g.eval(() => window.__wpn().id);

    // a ruby into the weapon: one ruby and 500 gold
    await g.eval(() => window.__GU.gemMenu('khan')); await g.step(2);
    await first(g);
    await pick(g, /Ruby/);
    assert.deepEqual(await bag(g), { gold: 1500, ruby: 1, topaz: 1, mstone: 30, estone: 30 });
    assert.equal(await g.eval(() => window.__wpn().gem), 'ruby');
    // a topaz over it: one topaz and 500 gold; the ruby in it is gone, not given back
    await first(g);
    await pick(g, /Topaz/);
    assert.deepEqual(await bag(g), { gold: 1000, ruby: 1, topaz: 0, mstone: 30, estone: 30 });
    assert.equal(await g.eval(() => window.__wpn().gem), 'topaz');
    // too little gold: nothing taken
    await g.eval(() => { window.__G.S.gold = 499; });
    await first(g);
    await pick(g, /Ruby/);
    assert.deepEqual(await bag(g), { gold: 499, ruby: 1, topaz: 0, mstone: 30, estone: 30 }, 'short of gold: nothing');
    assert.equal(await g.eval(() => window.__wpn().gem), 'topaz');
    await g.eval(() => { for (let i = 0; i < 6 && window.__G.mode === 'dialog'; i++) window.__G.advance(); });
    await g.step(2);

    // enhancements: each try takes its price, success or failure, up to +6 and past it (where a failure drops a level)
    await g.eval(() => { window.__G.S.gold = 5e6; window.__G.S.mats.mstone = 200; window.__G.S.mats.estone = 200; });
    for (let k = 0; k < 14; k++) {
      const before = await bag(g), c = await g.eval(() => window.__GENH.cost(window.__wpn())), en = await g.eval(() => window.__wpn().en | 0);
      if (en >= 10) break;
      await g.eval(() => window.__GENH.go(window.__wpn())); await g.step(2);
      const after = await bag(g), en2 = await g.eval(() => window.__wpn().en | 0);
      assert.deepEqual([before.gold - after.gold, before.mstone - after.mstone, before.estone - after.estone], [c.g, c.m, c.e], 'try ' + k + ' at +' + en);
      assert.ok(en2 === en + 1 || en2 === en || (en >= 6 && en2 === en - 1), '+' + en + ' -> +' + en2);
      await g.eval(() => { for (let i = 0; i < 6 && window.__G.mode === 'dialog'; i++) window.__G.advance(); });
      for (let i = 0; i < 20 && await g.eval(() => window.__G.mode !== 'play'); i++) { await g.step(5); await g.eval(() => window.__G.mode === 'dialog' && window.__G.advance()); }
    }
    // short of magic stones: nothing taken
    await g.eval(() => { window.__G.S.mats.mstone = 0; });
    const b0 = await bag(g), en0 = await g.eval(() => window.__wpn().en | 0);
    if (en0 < 10) {
      await g.eval(() => window.__GENH.go(window.__wpn())); await g.step(2);
      assert.deepEqual(await bag(g), b0, 'short of stones: nothing');
      assert.equal(await g.eval(() => window.__wpn().en | 0), en0);
    }
    assert.equal(await g.eval(() => window.__wpn().id), w, 'the same weapon all along');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
