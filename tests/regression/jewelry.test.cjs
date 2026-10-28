'use strict';
// Elizabeth's jewelry (v1.22): Elizabeth, a craftsman level accessories maker in Winston, makes necklaces and bracelets
// for two new gear slots. Each pair is a two-piece set (the Guardian's set gives +100 defense, as in the novel). Only
// she makes them, for jewels, mithril and gold.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('Elizabeth: her window, what she asks for, and the Guardian set worn in the new slots', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    await g.eval(() => { const G = window.__G; G.S.gold = 0; G.DL = null; G.talkNPC('eliz'); });
    await g.step(2);
    assert.match(await g.eval(() => document.getElementById('dialog').textContent), /My name is Elizabeth\. My class is an accessories maker and I am at the craftsman level\./);
    await g.eval(() => { const G = window.__G; for (let i = 0; i < 6 && G.DL && !G.DL.optOn; i++) G.advance(); });
    await g.step(1);
    const opts = await g.eval(() => [...document.querySelectorAll('#dopts [data-opt]')].map((o) => o.textContent + (o.classList.contains('poor') ? ' [poor]' : '')));
    for (const n of ['Guardian’s Necklace', 'Guardian’s Bracelet', 'Elizabeth’s Sapphire Necklace', 'Belial’s Black Jewel Bracelet']) assert.ok(opts.some((o) => o.includes('Make ' + n) && o.includes('[poor]')), n + ' in ' + opts.join(' | '));
    assert.ok(opts.some((o) => /Guardian’s Necklace[\s\S]*Mithril 0\/3 · Topaz 0\/1[\s\S]*30,000/.test(o)), opts.join(' | '));
    // without the materials she says so; with them she makes it
    await g.eval(() => { const G = window.__G; G.pickOpt(G.DL.opts.findIndex((o) => /Guardian’s Necklace/.test(o.l))); });
    await g.step(1);
    assert.match(await g.eval(() => window.__G.DL.lines.join('\n')), /don’t have the materials or the gold/);
    const r = await g.eval(() => { const G = window.__G, S = G.S, X = G.eqx, E = window.__GEZ; S.lv = 120; S.gold = 100000; S.mats.mith = 10; S.mats.topaz = 3;
      const d0 = X.defV(), n = E.make('gdneck'), b = E.make('gdbrace'); X.equip(n); X.equip(b);
      return { gold: S.gold, mith: S.mats.mith, topaz: S.mats.topaz, slots: [n.slot, b.slot, n.r, b.r], on: [X.eqIt('n') === n, X.eqIt('r') === b], set: window.__GSET.tier('gd'), dd: X.defV() - d0, forge: window.__GSET.rc('gdneck').unlock() }; });
    assert.equal(r.gold, 40000); assert.equal(r.mith, 4); assert.equal(r.topaz, 1);
    assert.deepEqual(r.slots, ['n', 'r', 2, 2]); assert.deepEqual(r.on, [true, true]);
    assert.ok(r.dd >= 100, 'defense +' + r.dd); assert.equal(r.forge, false);
    assert.ok(r.set, 'set tier ' + r.set);
    // the gear window has the two new slots
    await g.eval(() => { const G = window.__G; G.DL = null; document.getElementById('dialog').hidden = true; G.eqx.openEquip(); });
    await g.step(2);
    const eq = await g.eval(() => [...document.querySelectorAll('#equipW [data-eq]')].map((b) => b.dataset.eq).sort().join(''));
    assert.equal(eq, 'abeghkk1k2k3nrrluw'); // v1.95: nine more ring slots; v2.02: at level 120 the first three are open; v2.45 earrings, v2.48 underwear; v3.74 the relic slot (rl)
    assert.match(await g.eval(() => document.getElementById('equipW').textContent), /Necklace[\s\S]*Bracelet|Bracelet[\s\S]*Necklace/);
    if (process.env.SHOT) await g.page.screenshot({ path: process.env.SHOT + '-jewelry.png' });
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the Black Jewel set: Belial’s jewels, legendary rating, and the set bonus', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, S = G.S, X = G.eqx, E = window.__GEZ; S.lv = 460; S.gold = 2.6e6; Object.assign(S.mats, { bljewel: 4, diam: 8, mith: 80, estone: 20 });   // v3.11: pricier and harder
      const dm0 = window.__GSET.bon('dm'), n = E.make('bjneck'), b = E.make('bjbrace'); X.equip(n); X.equip(b);
      return { r: [n.r, b.r], gold: S.gold, bl: S.mats.bljewel, dm: +(window.__GSET.bon('dm') - dm0).toFixed(3), hpp: window.__GSET.bon('hpp'), more: E.has('bjneck') }; });
    assert.deepEqual(r.r, [4, 4]); assert.equal(r.gold, 200000); assert.equal(r.bl, 0);
    assert.equal(r.dm, 0.1); assert.ok(r.hpp >= 0.1); assert.equal(r.more, false);
    assert.match(await g.eval(() => [...document.querySelectorAll('#toasts > *')].map((e) => e.textContent).join(' | ')), /Elizabeth made you Belial’s Black Jewel Bracelet!/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
