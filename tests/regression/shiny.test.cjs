'use strict';
// v3.05 shiny things and the Scholar's Stew (the player Suki through the owner 2026-10-25: "Add different shiny variants of
// fish and ores. Same with food, like golden apples. Each item cooked/crafted/smith/caught being shiny grants special
// modifiers to your food armor or weapons… The addition of exp boosting food will also be appreciated"):
//   - a catch, ore, mithril, a herb or a harvest is shiny about 3% of the time (glow bait doubles it for fish);
//   - a shiny one counts as its plain kind, goes in first and makes what it goes into shiny: a dish (more food and healing,
//     its buff twice as long) or a piece (+10% ATK/DEF); a quest takes the plain ones first;
//   - their names, prices, the market's quota, the auction (its keys stay lowercase letters), the bag's tips;
//   - the Scholar's Stew: the 'sage' buff (+25% experience from monsters).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('shiny catches, ores and harvests; shiny dishes and gear; the Scholar\'s Stew', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, X = window.__GSH, K = window.__GTK, S = G.S, o = {};
      const zero = () => { for (const k of Object.keys(S.mats)) S.mats[k] = 0; };
      zero(); X.add('fish', 4000); o.sh1 = S.mats.shnfish; o.pl1 = S.mats.fish;
      zero(); X.add('fish', 4000, 2); o.sh2 = S.mats.shnfish;
      zero(); X.add('ore', 4000); o.ore = S.mats.shnore;
      zero(); X.add('wood', 50); o.wood = [S.mats.wood, S.mats.shnwood || 0];
      o.names = [G.lines().en.shnfish, G.lines().ar.shnmackerel, G.lines().en.shncfish];
      o.price = [G.bag().unitVal({ k: 'shnrtrout', n: 1 }), G.bag().unitVal({ k: 'rtrout', n: 1 })];
      o.mkq = X.MKQ.shnfish; o.auk = X.AUK.filter((k) => (X.K[k] || K.C.includes(k) || K.RA.includes(k)) && !/^[a-z]{2,12}$/.test(k)); o.aukBad = X.AUK.filter((k) => !/^[a-z]{2,12}$/.test(k)); o.aukSh = X.AUK.includes('shnjadekoi');
      // a shiny Mackerel cooks a shiny grilled fish
      zero(); S.mats.shnmackerel = 1; o.can = K.can('cfish'); K.make('cfish'); o.cookSh = X.COOKG && X.COOKG.sh; X.hit(); o.dish = [S.mats.shncfish || 0, S.mats.cfish || 0, S.mats.shnmackerel];
      // a plain pot: not shiny going in (a perfect strike still has its 12%)
      zero(); S.mats.fish = 1; K.make('cfish'); o.cookPl = X.COOKG && X.COOKG.sh; X.hit();
      return o;
    });
    assert.ok(r.sh1 >= 70 && r.sh1 <= 180, 'about 3% shiny: ' + r.sh1); assert.equal(r.sh1 + r.pl1, 4000);
    assert.ok(r.sh2 >= 170 && r.sh2 <= 330, 'glow bait doubles it: ' + r.sh2);
    assert.ok(r.ore >= 70 && r.ore <= 180, 'shiny ore: ' + r.ore);
    assert.deepEqual(r.wood, [50, 0], 'wood is never shiny');
    assert.deepEqual(r.names, ['✨ Fish', '✨ سمكة ماكريل', '✨ Grilled Fish']);
    assert.equal(r.price[0], r.price[1] * 4, 'four times the price');
    assert.equal(r.mkq, 3); assert.deepEqual(r.auk, [], 'the fish and shiny keys are lowercase letters, as the auction\'s rules want'); assert.equal(r.aukSh, true);
    assert.equal(r.can, true, 'a shiny fish cooks'); assert.equal(r.cookSh, true);
    assert.deepEqual(r.dish, [2, 0, 0], 'a perfect pot of a shiny fish: two shiny dishes');
    assert.equal(r.cookPl, false, 'a plain fish: not shiny');

    const r2 = await g.eval(() => {
      const G = window.__G, X = window.__GSH, K = window.__GTK, S = G.S, P = G.P, o = {};
      // a shiny dish: more food, more healing, its buff twice as long
      // quests: any common fish, shiny or not; the plain ones go first
      for (const k of Object.keys(S.mats)) S.mats[k] = 0;
      S.mats.fish = 3; S.mats.mackerel = 1; S.mats.shnfish = 2; S.qs.lf1 = { st: 1, c: 0 }; o.q = K.qc('lf1'); K.qdone('lf1'); o.qLeft = [S.mats.fish, S.mats.mackerel, S.mats.shnfish];
      // the anvil: shiny ore goes in first and makes the piece shiny
      S.qs.kh1 = { st: 2 }; S.mats.ore = 10; S.mats.shnore = 1; S.mats.wood = 5; o.forgeSh = X.forge('isword'); o.oreLeft = [S.mats.ore, S.mats.shnore];
      S.mats.ore = 10; S.mats.shnore = 0; o.forgePl = X.forge('isword');
      // (review) one shiny is enough: 10 shiny and 10 plain ore, only one shiny goes in
      S.mats.ore = 10; S.mats.shnore = 10; X.forge('isword'); o.oneSh = [S.mats.ore, S.mats.shnore];
      // (review) arrows and potions take the plain ones first and never shine
      S.mats.ore = 10; S.mats.shnore = 2; S.mats.wood = 10; o.arrow = X.forge('jaffa'); o.arrowLeft = S.mats.shnore;
      // (review) sewing with only a shiny herb never goes negative
      for (const k of Object.keys(S.mats)) S.mats[k] = 0; S.mats.shnherb = 3; S.mats.herb = 0; X.take('herb', 2, 0); o.sew = [S.mats.herb, S.mats.shnherb];
      // (review) fish: a shiny Mackerel goes in before plain Fish
      S.mats.fish = 5; S.mats.shnmackerel = 1; o.fishFirst = X.take('fish', 1, 1); o.fishLeft = [S.mats.fish, S.mats.shnmackerel];
      // (review) a quest for Grilled Fish counts a shiny one
      S.mats.cfish = 1; S.mats.shncfish = 1; o.dishHave = X.have('cfish');
      // a shiny piece: +10%, ✨ before its name, a line in its tip
      const it = X.mk('isword', 1), a0 = X.iAtk(it); it.sh = 1;
      o.atk = [a0, X.iAtk(it)]; o.name = X.inm(it);
      return o;
    });
    assert.equal(r2.q, 6, 'the fisherman counts shiny ones too'); assert.deepEqual(r2.qLeft, [0, 0, 1], 'the plain ones went first');
    assert.equal(r2.forgeSh, true); assert.deepEqual(r2.oreLeft, [6, 0], 'the shiny ore went in first');
    assert.equal(r2.forgePl, false);
    assert.deepEqual(r2.oneSh, [6, 9], 'one shiny ore and four plain');
    assert.equal(r2.arrow, false, 'arrows never shine'); assert.equal(r2.arrowLeft, 2, 'and keep the shiny ore');
    assert.deepEqual(r2.sew, [0, 1], 'shiny herbs taken, nothing negative');
    assert.equal(r2.fishFirst, 1); assert.deepEqual(r2.fishLeft, [5, 0], 'the shiny Mackerel first');
    assert.equal(r2.dishHave, 2, 'a shiny dish counts for a quest');
    assert.equal(r2.atk[1], Math.round(r2.atk[0] * 1.1), 'shiny: +10% ATK ' + r2.atk);
    assert.match(r2.name, /^✨ /);

    // eating: a shiny stew gives half again the food and its buff twice as long; the Scholar's Stew gives the sage buff
    await g.page.waitForTimeout(800); await g.step(3); // the pot goes back to the campfire's menu after 650 ms
    for (let i = 0; i < 6 && await g.eval(() => window.__G.mode) !== 'play'; i++) { await g.page.keyboard.press('Escape'); await g.step(2); }
    const eat = async (k) => g.eval((k) => { const B = window.__G.bag(), i = B.INVS.findIndex((s) => s.k === k); window.__G.P.food = 0; window.__G.P.buf = null; B.invClick(i); return { food: window.__G.P.food, buf: window.__G.P.buf && { ...window.__G.P.buf } }; }, k);
    await g.eval(() => { const S = window.__G.S; S.mats.stew = 1; S.mats.shnstew = 1; S.mats.sstew = 1; });
    await g.page.keyboard.press('KeyI'); await g.step(3);
    const tip = await g.eval(() => (window.__G.bag().INVS.find((s) => s.k === 'shnstew') || {}).tip || '');
    assert.match(tip, /Shiny: half again the food/);
    const e1 = await eat('stew'), e2 = await eat('shnstew'), e3 = await eat('sstew');
    assert.equal(e2.food, Math.round(e1.food * 1.5), 'shiny: half again the food ' + [e1.food, e2.food]);
    assert.equal(e2.buf.t, e1.buf.t * 2, 'its buff twice as long'); assert.equal(e1.buf.k, e2.buf.k);
    assert.equal(e3.buf.k, 'sage'); assert.equal(e3.buf.t, 600);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
