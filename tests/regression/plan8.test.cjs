'use strict';
// Plan batch 8 (owner 2026-10-26 21:35: "keep making updates, don't stop"): U151 the spectators' ring at the Guardian's den;
// U268 where a piece came from; U098 the alchemist's new brews and fresh herbs; U093 the Legendary Farmer's helping step.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const closeDialogs = async (g) => {   // a menu is left with Escape, a line by going on
  for (let i = 0; i < 10 && await g.eval(() => window.__G.mode) === 'dialog'; i++) {
    if (await g.eval(() => { const D = window.__G.DL; return !!(D && D.opts && D.opts.length); })) await g.page.keyboard.press('Escape'); else await g.eval(() => window.__G.advance());
    await g.step(2);
  }
};

test('the spectators\' ring: he never comes for you there, none of his blows lands on you, and none of yours on him', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, X = window.__GPB7, Y = window.__GPB8, h = X.gdHome(), gd = X.mons().find((m) => m.type === 'guardian'), o = {};
      o.where = [X.gdRing(h.x + 100, h.y), X.gdRing(h.x + 260, h.y), X.gdRing(h.x, h.y + 260 * 0.75), X.gdRing(h.x + 400, h.y)];
      const P = G.P; P.x = h.x + 260; P.y = h.y; P.hp = P.max || P.hp;
      const hp0 = gd.hp; o.hit = X.hitMon(gd, 1000, { pure: 1 }); o.hpSame = gd.hp === hp0;
      const ph = P.hp; Y.hurt(500, gd); o.safe = P.hp === ph;
      // he was coming for you; in the ring he goes home
      gd.x = gd.sx + 40; gd.y = gd.sy; gd.eng = 4; gd.agg = 1; const dP0 = Math.hypot(P.x - gd.x, P.y - gd.y); for (let i = 0; i < 60; i++) X.monTick(gd, 0.1); o.home = Math.round(Math.hypot(gd.x - gd.sx, gd.y - gd.sy)); o.away = Math.hypot(P.x - gd.x, P.y - gd.y) >= dP0;
      // out of the ring it's a fight again
      P.x = h.x + 60; const ph2 = P.hp; Y.hurt(500, gd); o.hurtOut = P.hp < ph2;
      return o;
    });
    assert.deepEqual(r.where, [false, true, true, false], 'the ring, not the den or beyond');
    assert.equal(r.hit, 0); assert.equal(r.hpSame, true, 'no blow lands on him from the ring');
    assert.equal(r.safe, true, 'none of his lands on you');
    assert.ok(r.home < 10, 'he goes back to his den: ' + r.home); assert.equal(r.away, true, 'not toward the ring');
    assert.equal(r.hurtOut, true, 'out of the ring he hurts');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('where a piece came from: bought, dropped, read back from a trade only in its own shape, shown on the piece', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, X = window.__GPB7, Y = window.__GPB8, o = {};
      S.gold = 1e6; Y.buy('isword', 100, 'armorer'); const it = S.items[S.items.length - 1]; o.bought = it.src;
      o.tip = X.itemTip(it).includes('Bought from Armorer');
      const gd = X.mons().find((m) => m.type === 'guardian'); let n0 = S.items.length;
      for (let i = 0; i < 400 && S.items.length === n0; i++) X.namedDrop(gd);
      o.drop = S.items.length > n0 ? S.items[S.items.length - 1].src : 'none';
      o.text = X.srcTxt(o.drop);
      const a = X.tradeIn(JSON.stringify({ id: 'isword', r: 1, dur: 90, src: 'd:gchief' })), b = X.tradeIn(JSON.stringify({ id: 'isword', r: 1, dur: 90, src: '<img>' }));
      o.trade = [a.src, 'src' in b];
      return o;
    });
    assert.equal(r.bought, 's:armorer'); assert.equal(r.tip, true);
    assert.equal(r.drop, 'd:guardian'); assert.equal(r.text, 'Dropped by Guardian of the Forest');
    assert.deepEqual(r.trade, ['d:gchief', false], 'a traded piece keeps its origin; a bad one is dropped');
    await closeDialogs(g);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the alchemist: Stoneskin and Swiftness potions from their books; fresh herbs give one more', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, Y = window.__GPB8, o = {};
      S.rbk = Object.assign(S.rbk || {}, { rb_a_stonep: 1, rb_a_swiftp: 1 }); S.mats.herb = 20; S.mats.ore = 20; S.mats.bherb = 5; S.mats.straw = 10;
      const brew = (k) => { const n0 = S.mats[k] || 0; Y.make(k, true); const fr = Y.MIXG && Y.MIXG.fresh; Y.mixEnd(2); return [(S.mats[k] || 0) - n0, fr]; };
      S.hpk = 0; o.stale = brew('stonep');
      S.hpk = Date.now(); o.fresh = brew('stonep'); o.swift = brew('swiftp');
      o.used = [S.mats.herb, S.mats.ore, S.mats.bherb, S.mats.straw];
      // the Stoneskin Potion: a blow does 15% less
      G.P.buf = null; G.P.inv = 0; G.P.hp = 1e6; let h = G.P.hp; Y.hurt(1000, null); const plain = h - G.P.hp;
      Y.eat('stonep'); o.buf = G.P.buf && G.P.buf.k; G.P.inv = 0; G.P.dash = 0; h = G.P.hp; Y.hurt(1000, null); o.ratio = Math.round((h - G.P.hp) / plain * 100) / 100;
      return o;
    });
    assert.deepEqual(r.stale, [2, 0], 'a perfect brew: two');
    assert.deepEqual(r.fresh, [3, 1], 'with fresh herbs: one more');
    assert.deepEqual(r.swift, [3, 1]);
    assert.deepEqual(r.used, [20 - 4 - 0, 20 - 6, 5 - 1, 10 - 3]);
    assert.equal(r.buf, 'stone');
    assert.ok(Math.abs(r.ratio - 0.85) <= 0.02, '15% less: ' + r.ratio);
    // the Swiftness Potion: farther in the same time
    const home = await g.eval(() => ({ x: window.__G.P.x, y: window.__G.P.y }));
    const walk = async () => {
      await g.eval((h) => { const P = window.__G.P; P.x = h.x; P.y = h.y; }, home);
      const x0 = await g.eval(() => window.__G.P.x);
      await g.page.keyboard.down('ArrowRight'); await g.step(30); await g.page.keyboard.up('ArrowRight'); await g.step(2);
      return (await g.eval(() => window.__G.P.x)) - x0;
    };
    await g.page.waitForTimeout(1200);   // each brew's end brings the camp menu back after 700 ms of real time
    await closeDialogs(g);
    await g.eval(() => { const G = window.__G; G.P.buf = null; G.S.mats.swiftp = 1; G.P.stun = 0; });
    const d0 = await walk();
    await g.eval(() => { window.__GPB8.eat('swiftp'); window.__G.P.stun = 0; });
    const d1 = await walk();
    assert.ok(d0 > 30, 'it walked: ' + d0);
    assert.ok(Math.abs(d1 / d0 - 1.12) <= 0.03, '12% faster: ' + d0 + ' → ' + d1);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the Legendary Farmer\'s trial: twenty wheat for Patrian before the Legendary Field', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, Y = window.__GPB8, o = {};
      S.lv = 40; S.sec = 'farmer'; S.qs.lfa1 = { st: 2 };
      o.before = [Y.avail('lfa1h'), Y.avail('lfa2')];
      Y.accept('lfa1h'); S.mats.wheat = 12; o.short = Y.ready('lfa1h'); S.mats.wheat = 25; o.ready = Y.ready('lfa1h');
      Y.complete('lfa1h'); o.left = S.mats.wheat; o.after = Y.avail('lfa2');
      return o;
    });
    assert.deepEqual(r.before, [true, false], 'the helping step comes first');
    assert.equal(r.short, false); assert.equal(r.ready, true);
    assert.equal(r.left, 5, 'twenty wheat given');
    assert.equal(r.after, true, 'then the Legendary Field');
    await closeDialogs(g);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
