'use strict';
// Plan batch 5b (owner 2026-10-26 19:41: "continue the document's updates"): U254 the magic circles and the portal's
// landing on the world map; U257 the forge's odds before forging; U262 the auction's kinds, price cap and sort; U190
// Khan's dodge and party steps. (U276's gem moving is main's, from the plan-gear branch.)
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

async function settle(...games) {
  for (let i = 0; i < 8; i++) { for (const g of games) await g.step(7); await games[0].page.waitForTimeout(30); }
}
async function until(g, fn, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await g.eval(fn)) return; await g.step(3); await g.page.waitForTimeout(30); }
  throw new Error('timed out waiting for ' + fn);
}

const labels = (g) => g.eval(() => {
  const G = window.__G, MM = window.SatArt.minimap, out = [], l0 = MM.label;
  MM.label = function (g2, text) { out.push(String(text)); return l0.apply(this, arguments); };
  try { G.mapBase(); G.MV.z = 1; G.mapDraw(); } finally { MM.label = l0; }
  return out;
});

test('the forge odds, the auction filters and Khan\'s steps', async () => {
  const g = await H.openGame({});
  try {
    await g.page.setViewportSize({ width: 1600, height: 900 });
    await H.newGame(g);
    // U257: the odds shown are what forging rolls (40,000 forgings at each score against the same function)
    const od = await g.eval(() => { const S = window.__G.S, X = window.__GP5B, rc = X.rc('isword'); S.smith = 10; const o = {};
      for (const s of [1, .84, .6]) { const p = X.odds(rc, s), b = X.forgeB(rc), c = [0, 0, 0, 0, 0], N = 40000;
        for (let i = 0; i < N; i++) c[X.roll(b + s + (Math.random() - .5) * .08)]++;
        o[s] = { sum: p.reduce((a, x) => a + x, 0), d: Math.max(...p.map((x, r) => Math.abs(x - c[r] / N))), leg: p[4] }; }
      o.tip = X.oddsTip(rc); return o; });
    for (const s of ['1', '0.84', '0.6']) { assert.ok(Math.abs(od[s].sum - 1) < 1e-9, s + ' sums to 1'); assert.ok(od[s].d < .012, s + ' matches the rolls: ' + od[s].d); assert.equal(od[s].leg, 0, 'no Legendary but for Pagma\'s Successor'); }
    assert.match(od.tip, /All perfect/); assert.match(od.tip, /Rare/);

    // U262: kinds, a price cap per unit, and three sorts
    const au = await g.eval(() => { const X = window.__GP5B, L = [{ id: 'a', it: 'ruby', q: 2, price: 1000, t: 3 }, { id: 'b', it: 'ore', q: 10, price: 500, t: 1 }, { id: 'c', it: 'hpot', q: 5, price: 900, t: 2 }, { id: 'd', it: 'mumbk', q: 1, price: 200000, t: 4 }];
      return { kinds: ['ruby', 'ore', 'hpot', 'mumbk', 'shnore', 'herb', 'brdrg'].map(X.kind), gem: X.shown(L, { k: 'gem' }), cap: X.shown(L, { max: 100 }), unit: X.shown(L, { s: 'unit' }), total: X.shown(L, { s: 'total' }), new: X.shown(L, { s: 'new' }) }; });
    assert.deepEqual(au, { kinds: ['gem', 'metal', 'pot', 'book', 'metal', 'farm', 'beast'], gem: ['a'], cap: ['b'], unit: ['b', 'c', 'a', 'd'], total: ['b', 'c', 'a', 'd'], new: ['d', 'a', 'c', 'b'] });

    // U190: Khan's dodge step opens after his first quest; three dodges finish it. The party step waits for online play.
    const kh = await g.eval(() => { const S = window.__G.S, X = window.__GP5B, o = { before: X.avail('khd') };
      S.qs.kh1 = { st: 2 }; o.after = X.avail('khd'); S.qs.khd = { st: 1, c: 0 }; for (let i = 0; i < 3; i++) X.dodge(); o.ready = X.ready('khd');
      S.qs.kh3 = { st: 2 }; o.party = X.avail('khp'); return o; });
    assert.deepEqual(kh, { before: false, after: true, ready: true, party: false });

    // (review) a dropdown keeps its own keys, and Escape on it still closes the auction
    await g.eval(() => window.__G.talkNPC('auction')); await g.step(2);
    assert.equal(await g.mode(), 'au');
    await g.eval(() => { window.__selKeys = []; addEventListener('keydown', (e) => window.__selKeys.push([e.code, e.defaultPrevented])); document.getElementById('auK').focus(); });
    await g.page.keyboard.press('ArrowDown'); await g.step(2);
    assert.deepEqual(await g.eval(() => window.__selKeys), [['ArrowDown', false]], 'the arrow reaches the dropdown');
    await g.page.keyboard.press('Escape'); await g.step(2);
    assert.equal(await g.mode(), 'play', 'Escape closes the auction');

    // U254: the world map marks the magic circles and the portal's landing once seen (the West's circle at Reinhardt...)
    await g.eval(() => { window.__GP5B.fogAll(); });
    await g.page.keyboard.press('m'); await g.step(2);
    const W = await labels(g);
    assert.equal(W.filter((t) => t === 'Magic circle').length, 1, 'Reinhardt\'s circle on the West map');
    assert.ok(!W.includes('Portal landing'), 'the portal\'s landing is on the East\'s map');
    await g.page.keyboard.press('m'); await g.step(2);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('the East map: the White Tree Forest\'s circle and the portal\'s landing', async () => {
  const g = await H.openGame({});
  try {
    await g.page.setViewportSize({ width: 1600, height: 900 });
    await H.newGame(g);
    await g.eval(() => { const G = window.__G, c = window.__GP5B.circ(); G.S.lv = 300; G.P.x = c.e.x * 16; G.P.y = (c.e.y + 3) * 16; G.P.inv = 1e9; window.__GP5B.fogAll(); });
    await g.step(5);
    await g.page.keyboard.press('m'); await g.step(2);
    const E = await labels(g);
    assert.equal(E.filter((t) => t === 'Magic circle').length, 1, 'the White Tree Forest\'s circle');
    assert.ok(E.includes('Portal landing'));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});

test('Khan\'s party step: a party joined after taking it, or one you are already in when you take it', async () => {
  const ctx = await H.newContext({});
  const a = await H.openGame({ ctx, query: '?net=local&slot=a' });
  const b = await H.openGame({ ctx, query: '?net=local&slot=b' });
  try {
    await H.newGame(a, { n: 'Grid', hair: 1, hc: 2, skin: 1, top: 3 });
    await H.newGame(b, { n: 'Faker', hair: 3, hc: 0, skin: 2, top: 1 });
    await b.eval(() => { window.__G.P.x += 20; });
    await settle(a, b);
    const take = () => { const S = window.__G.S; S.qs.kh1 = { st: 2 }; S.qs.kh3 = { st: 2 }; window.__GP5B.accept('khp'); return window.__GP5B.ready('khp'); };
    assert.equal(await b.eval(take), false, 'no party yet');
    await a.page.keyboard.press('KeyP');
    await settle(a, b);
    await until(b, () => !document.getElementById('partyInv').hidden);
    await b.page.keyboard.press('KeyY');
    await settle(a, b);
    await until(b, () => window.__GP5B.ready('khp'));
    await until(a, () => ((Satisfy.local.net().party || {}).members || []).length === 2);
    assert.equal(await a.eval(take), true, 'already in a party when taking the step');
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally { await ctx.close(); }
});
