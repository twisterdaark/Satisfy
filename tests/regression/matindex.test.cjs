'use strict';
// v3.12 The Index's Materials (the owner 2026-10-26: "add to the index, Materials tab to know where to get each material for
// crafting"): every material a recipe asks for, where it comes from (veins, herbs, trees, waters, the field, the monsters that
// carry it, bosses' chests and stones, quests, discoveries, shops, the market, taking apart) and what it makes.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('every recipe material with where to get it and what it makes; the filters and the search', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    await g.step(3);
    const r = await g.eval(() => {
      const X = window.__GIX, o = { det: {} };
      X.open(); X.tab('mat'); o.cards = X.cards(); o.tab = !!document.querySelector('#ixTabs [data-ixt="mat"]');
      for (const id of o.cards) { X.tab('mat', id); o.det[id] = X.det(); }
      X.tab('mat'); X.filt('trc'); o.trc = X.cards(); X.filt('life'); o.life = X.cards(); X.filt('rc'); o.rc = X.cards(); X.filt('all');
      // a monster you have met can be searched by its name; one you haven't stays ???
      const G = window.__G; G.S.kills = G.S.kills || {}; G.S.kills.goblin = 1;
      const q = document.getElementById('ixQ'); q.value = (window.__GMB.detail('goblin').match(/<b>([^<]+)<\/b>/) || [])[1] || 'Goblin'; q.dispatchEvent(new Event('input')); o.search = X.cards(); q.value = ''; q.dispatchEvent(new Event('input'));
      X.close(); return o;
    });
    assert.equal(r.tab, true);
    for (const id of ['wood', 'ore', 'leather', 'mith', 'mstone', 'estone', 'bljewel', 'diam', 'fish', 'herb', 'bherb', 'wheat']) assert.ok(r.cards.includes(id), 'card ' + id);
    for (const [id, d] of Object.entries(r.det)) {
      assert.match(d, /Where to get it/, id); assert.match(d, /Used to make/, id);
      assert.doesNotMatch(d, /undefined|NaN|\{[a-z]+\}/, id);
    }
    assert.match(r.det.ore, /Iron veins.*\(.+\)/); assert.match(r.det.ore, /sells it to a blacksmith: 8 gold each/); assert.match(r.det.ore, /The market/);
    assert.match(r.det.mith, /Mithril veins/); assert.match(r.det.herb, /Herbs in the fields/); assert.match(r.det.wood, /Trees/);
    assert.match(r.det.estone, /Every boss of Lv 20/); assert.match(r.det.estone, /boss's chest/);
    assert.match(r.det.fish, /any common fish counts/); assert.match(r.det.wheat, /Piaro's Field: plant it/);
    assert.match(r.det.bljewel, /Belial \(world boss\)/); assert.match(r.det.bljewel, /At Elizabeth's/);
    // (review) the gem drop, the town-rank and Tower of Wisdom shops, the coachmen, a Creation taken apart, enhancement
    assert.match(r.det.ruby, /can drop a gem: this one 20%/); assert.match(r.det.diam, /this one 10%/);
    assert.match(r.det.estone, /A town's merchant sells it to one Town Hero/); assert.match(r.det.estone, /Radwolf's shop in the Tower of Wisdom: 5 for 4 marks/);
    assert.match(r.det.vherb, /coachmen sell it/); assert.match(r.det.bljewel, /Taking apart a Creation made with it/); assert.match(r.det.mstone, /Enhancing gear/);
    assert.match(r.det.ndiron, /from Lv 250: each once a day/); assert.match(r.det.herb, /digging game/);
    assert.match(r.det.leather, /Dropped by/); assert.match(r.det.leather, /more monsters/);
    // the filters: what each kind of work uses
    assert.ok(r.trc.includes('leather') && r.trc.includes('herb') && !r.trc.includes('ore'), JSON.stringify(r.trc));
    assert.ok(r.life.includes('fish') && r.life.includes('wheat') && !r.life.includes('mith'), JSON.stringify(r.life));
    assert.ok(r.rc.includes('ore') && r.rc.includes('bljewel') && !r.rc.includes('wheat'), JSON.stringify(r.rc));
    assert.ok(r.search.length > 0 && r.search.length < r.cards.length, JSON.stringify(r.search));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
