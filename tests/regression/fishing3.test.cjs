'use strict';
// v3.03 fishing (the player Suki through the owner 2026-10-25: "more fish species… Different fishing rods that can be sold
// by a vendor in winston… different bait type's for fishermen and each one with different benefits. Redistribute fish
// species across the entire map, each biome with its own rare and "common" fish"):
//   - each water its own two fish: the lake by Winston fresh, the sea by Brinichi, the Glacier Lakes' snow, Haalrune Swamp, the
//     East Continent; the Golden Fish anywhere; a rare one only past the common one's dice;
//   - a rod makes the moment to reel in longer and rare fish likelier; a bait goes on each cast and does its own thing;
//   - Winston's merchant sells the rods above yours (the better ones from a Fishing level) and the baits;
//   - any common fish cooks, feeds the cat and fills a fisherman's "bring fish" quest;
//   - the bag: the bait you click goes on your hook; the Index's Fishing page hides a rare fish you haven't caught;
//   - the festival board's rules know every kind's top weight, and the market and the prices know every fish.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('fishing: the waters and their fish, the rods, the bait, the merchant', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, T = window.__GTRK, K = window.__GTK, S = G.S, o = {};
      // one water tile in a box
      const wat = (x0, x1, y0, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (T.at(x, y) === 4) return [x * 16 + 8, y * 16 + 8]; return null; };
      const W = { fresh: wat(86, 100, 94, 106), sea: wat(568, 590, 250, 270), snow: wat(420, 572, -42, -6), swamp: wat(576, 624, 48, 106), east: wat(1470, 1590, -4, 82) };
      o.reg = Object.fromEntries(Object.entries(W).map(([k, p]) => [k, p && K.reg(p[0], p[1])]));
      // the dice: 0.99 = no; 0 = yes (the Golden Fish first, then the rare one)
      const seq = (a) => { let i = 0; return () => a[i++ % a.length]; };
      const N = { fest: false, rain: false }; // the festival and the rain as they are not, whatever the clock and the sky
      o.pick = Object.fromEntries(Object.keys(K.Z).map((z) => [z, [K.pick({ reg: z, ...N }, seq([0.99, 0.99])), K.pick({ reg: z, ...N }, seq([0.99, 0])), K.pick({ reg: z, ...N }, seq([0]))]]));
      // at Fishing 1 with the Old Rod the rare chance is 6%: a 0.08 die misses; the Mithril Rod (x1.7) and shrimp (x1.5) each make it
      S.rod = 0; S.bait = null; o.r0 = K.pick({ reg: 'fresh', ...N }, seq([0.99, 0.08]));
      S.rod = 3; o.r3 = K.pick({ reg: 'fresh', ...N }, seq([0.99, 0.08]));
      S.rod = 0; o.rb = K.pick({ reg: 'fresh', b: 'bshrimp', ...N }, seq([0.99, 0.08]));
      o.rw = K.pick({ reg: 'fresh', b: 'bworm', ...N }, seq([0.99, 0.08]));
      // the Golden Fish: 2.8% at Fishing 1; glow bait doubles it
      o.g0 = K.pick({ reg: 'sea', ...N }, seq([0.05, 0.99])); o.gb = K.pick({ reg: 'sea', b: 'bglow', ...N }, seq([0.05, 0.99]));
      // the festival triples the Golden Fish, rain makes it x1.5
      o.gf = K.pick({ reg: 'sea', fest: true, rain: false }, seq([0.05, 0.99])); o.gr = K.pick({ reg: 'sea', fest: false, rain: true }, seq([0.035, 0.99]));
      // worms: the wait for a bite x0.6
      o.bite = [K.bite(0.5, 1), K.bite(0.5, 1, 'bworm')];
      const B0 = G.bag();
      // the merchant: rods above yours, and the baits
      S.gold = 1000; S.rod = 0; S.life = {}; const op = K.opts();
      o.opts = op.map((x) => [x.ic, !!x.poor, x.st]);
      K.buy(2); o.low = [S.rod | 0, S.gold];
      K.buy(1); o.oak = [S.rod, S.gold];
      o.after = K.opts().map((x) => x.ic);
      S.life.fish = 2600; S.gold = 30000; K.buy(3); o.mith = [S.rod, S.gold, K.opts().map((x) => x.ic)];
      // a cast takes one bait; out of it, the cast goes bare and the bait stays chosen
      S.mats.bworm = 1; S.bait = 'bworm'; o.c1 = K.cast(); o.left = [S.mats.bworm, S.bait]; o.c2 = K.cast();
      // a bait sold off the hook: the next cast goes bare and takes it off
      S.mats.bshrimp = 0; S.bait = 'bshrimp'; o.c3 = K.cast(); o.left2 = S.bait;
      // bait sells back for less than it costs, whatever the discounts
      o.baitP = Object.keys(K.B).map((k) => [k, K.B[k].g, B0.unitVal({ k, n: 1 })]);
      // the common fish together: cooking, the cat, a fisherman's quest
      for (const k of K.C) S.mats[k] = 0; S.mats.gfish = 0;
      S.mats.mackerel = 1; o.cook = K.can('cfish'); S.mats.mackerel = 0; S.mats.catfish = 1; S.mats.ecarp = 1; S.mats.herb = 2; o.stew = K.can('stew');
      K.make('stew'); o.stewAte = [S.mats.catfish, S.mats.ecarp, S.mats.herb];
      G.mode && 0; S.mats.rtrout = 3; o.rare = K.can('cfish');
      S.mats.mackerel = 2; S.mats.sfish = 2; S.mats.fish = 1; S.qs.lf1 = { st: 1, c: 0 }; o.q = K.qc('lf1'); S.gold = 0; K.qdone('lf1'); o.qAfter = [S.mats.mackerel, S.mats.sfish, S.mats.fish, S.mats.rtrout, S.gold];
      // the tips, the market, the prices
      o.tip = [K.tip('mackerel'), K.tip('jadekoi'), K.tip('gfish')];
      const B = G.bag(); o.mkt = [...K.C, ...K.RA].filter((k) => !(B.unitVal({ k, n: 1 }) > 0)); o.W = Object.fromEntries([...K.C, ...K.RA, 'gfish'].map((k) => [k, K.W[k][1]]));
      return o;
    });
    assert.deepEqual(r.reg, { fresh: 'fresh', sea: 'sea', snow: 'snow', swamp: 'swamp', east: 'east' }, JSON.stringify(r.reg));
    assert.deepEqual(r.pick, { fresh: ['fish', 'rtrout', 'gfish'], snow: ['sfish', 'icepike', 'gfish'], sea: ['mackerel', 'snapper', 'gfish'], swamp: ['catfish', 'bogeel', 'gfish'], east: ['ecarp', 'jadekoi', 'gfish'] });
    assert.equal(r.r0, 'fish'); assert.equal(r.r3, 'rtrout', 'the Mithril Rod'); assert.equal(r.rb, 'rtrout', 'shrimp'); assert.equal(r.rw, 'fish', 'worms do not help rare fish');
    assert.equal(r.g0, 'mackerel'); assert.equal(r.gb, 'gfish', 'glow bait');
    assert.deepEqual(r.opts.map((x) => x[0]), ['tkrod1', 'tkrod2', 'tkrod3', 'bworm', 'bshrimp', 'bglow']);
    assert.deepEqual(r.opts.map((x) => x[1]), [false, true, true, false, false, false], 'the better rods need a Fishing level and gold');
    assert.match(r.opts[1][2], /needs Fishing 4/);
    assert.deepEqual(r.low, [0, 1000], 'no Steel Rod at Fishing 1');
    assert.equal(r.oak[0], 1); assert.ok(r.oak[1] < 1000 && r.oak[1] >= 700, 'the Oak Rod for about 300: ' + r.oak[1]);
    assert.deepEqual(r.after, ['tkrod2', 'tkrod3', 'bworm', 'bshrimp', 'bglow'], 'only the rods above yours');
    assert.equal(r.mith[0], 3); assert.ok(r.mith[1] <= 10000, String(r.mith[1])); assert.deepEqual(r.mith[2], ['bworm', 'bshrimp', 'bglow']);
    assert.equal(r.c1, 'bworm'); assert.deepEqual(r.left, [0, null], 'the last worm comes off the hook'); assert.equal(r.c2, null);
    assert.equal(r.c3, null); assert.equal(r.left2, null, 'a bait you no longer have comes off');
    for (const [k, g, sell] of r.baitP) assert.ok(sell * 1.25 < g, k + ' sells back for less than it costs: ' + [g, sell]);
    assert.equal(r.gf, 'gfish', 'the festival'); assert.equal(r.gr, 'gfish', 'rain');
    assert.ok(Math.abs(r.bite[1] - r.bite[0] * 0.6) < 1e-9, 'worms: ' + r.bite);
    assert.equal(r.cook, true, 'mackerel cooks'); assert.equal(r.stew, true, 'two different common fish make a stew');
    assert.deepEqual(r.stewAte, [0, 0, 0]);
    assert.equal(r.rare, false, 'a rare fish is not a common fish');
    assert.equal(r.q, 5, 'any common fish for the fisherman');
    assert.deepEqual(r.qAfter.slice(0, 4), [0, 0, 0, 3], 'Fish first, then the others; never the rare ones');
    assert.ok(r.qAfter[4] >= 60, 'the reward');
    assert.match(r.tip[0], /common fish of the sea\./); assert.match(r.tip[1], /rare fish of the East Continent\./); assert.match(r.tip[2], /any water/);
    assert.deepEqual(r.mkt, [], 'every fish has a price');
    // the board's rules: every kind, and its top weight is what that kind can weigh at Fishing 10
    const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '../../backend/database.rules.json'), 'utf8')).rules.fishFest.$s.$uid;
    for (const [k, w] of Object.entries(r.W)) {
      assert.ok(rules.k['.validate'].includes(`'${k}'`), 'the rules know ' + k);
      const top = k === 'fish' ? +rules.w['.validate'].match(/: (\d+)\)$/)[1] : +(rules.w['.validate'].match(new RegExp(`'${k}' \\? (\\d+)`)) || [])[1];
      assert.equal(top, Math.ceil(Math.round(w * 12 * 1000) / 1000), k + ' top weight');
    }
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('fishing: a real cast with bait and a rod, the bag, the Index', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const spot = await g.eval(() => window.__GFS.water());
    await g.eval((s) => { const G = window.__G, P = G.P; P.x = s[0]; P.y = s[1]; G.S.rod = 2; G.S.mats.bworm = 3; G.S.bait = 'bworm'; }, spot);
    await g.step(3);
    assert.equal(await g.eval(() => window.__GFS.start()), true);
    const F = await g.eval(() => { const F = window.__GFS.F, S = window.__G.S; return { bite: F.bite, win: F.win, b: F.b, reg: F.reg, left: S.mats.bworm }; });
    assert.equal(F.b, 'bworm'); assert.equal(F.left, 2); assert.equal(F.reg, 'fresh');
    assert.ok(F.bite <= (2 + 3 - 0.12) * 0.6 + 1e-9, 'worms: a sooner bite ' + F.bite);
    assert.ok(Math.abs(F.win - 0.55 * 1.5) < 1e-9, 'the Steel Rod: longer to reel in ' + F.win);
    for (let i = 0; i < 80 && await g.eval(() => { const F = window.__GFS.F; return F && F.t < F.bite; }); i++) await g.step(5);
    await g.step(2);
    await g.eval(() => window.__GFS.act());
    await g.step(40); await g.page.waitForTimeout(600); await g.step(5);
    const caught = await g.eval(() => { const S = window.__G.S; return ['fish', 'rtrout', 'gfish'].filter((k) => S.mats[k] > 0); });
    assert.equal(caught.length, 1, 'a fish of the lake: ' + caught);
    // the bag: the baits with the one on your hook marked; a click takes it off, another puts it back
    const bag = await g.eval(() => { const G = window.__G, S = G.S, B = G.bag(); S.mats.bshrimp = 4; G.openInv ? 0 : 0; return 1; });
    assert.equal(bag, 1);
    await g.page.keyboard.press('KeyI'); await g.step(3);
    const b1 = await g.eval(() => { const B = window.__G.bag(), i = B.INVS.findIndex((s) => s.k === 'bworm'), j = B.INVS.findIndex((s) => s.k === 'bshrimp'); return { i, j, hook: B.INVS[i] && B.INVS[i].hook, eq: B.INVS[i] && B.INVS[i].eq, cls: document.querySelector(`#igrid [data-inv="${i}"]`).className, tip: B.INVS[i] && B.INVS[i].tip }; });
    assert.ok(b1.i >= 0 && b1.j >= 0, 'the baits are in the bag'); assert.equal(b1.hook, true); assert.ok(!b1.eq, 'marked, not worn: it still sells'); assert.match(b1.cls, /\beq\b/); assert.match(b1.tip, /On your hook/);
    await g.eval((j) => window.__G.bag().invClick(j), b1.j); await g.step(2);
    assert.equal(await g.eval(() => window.__G.S.bait), 'bshrimp');
    const j2 = await g.eval(() => window.__G.bag().INVS.findIndex((s) => s.k === 'bshrimp'));
    await g.eval((j) => window.__G.bag().invClick(j), j2); await g.step(2);
    assert.equal(await g.eval(() => window.__G.S.bait), null, 'clicked again: off');
    await g.page.keyboard.press('KeyI'); await g.step(3);
    // the Index: the Fishing page; a rare fish is ??? until caught
    await g.eval(() => { const S = window.__G.S; S.fishR = { rtrout: 3.1 }; S.mats.rtrout = 0; S.mats.icepike = 0; window.__GIX.open(); window.__GIX.tab('fish', 'fresh'); });
    await g.step(2);
    const ix = await g.eval(() => ({ fresh: document.getElementById('ixD').textContent, cards: [...document.querySelectorAll('#ixG [data-ix]')].map((e) => e.dataset.ix) }));
    assert.deepEqual(ix.cards, ['guide', 'fresh', 'snow', 'sea', 'swamp', 'east', 'rods', 'bait']);
    assert.match(ix.fresh, /Rainbow Trout/); assert.match(ix.fresh, /your heaviest 3\.1 kg/);
    await g.eval(() => window.__GIX.tab('fish', 'snow')); await g.step(2);
    const snow = await g.eval(() => document.getElementById('ixD').textContent);
    assert.match(snow, /\?\?\?/); assert.doesNotMatch(snow, /Ice Pike/, 'not caught yet');
    await g.eval(() => window.__GIX.tab('fish', 'rods')); await g.step(2);
    assert.match(await g.eval(() => document.getElementById('ixD').textContent), /Steel Rod\s*yours/);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
