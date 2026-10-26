'use strict';
// Plan batch 5 (owner 2026-10-26 19:41: "continue the document's updates"): U285 a piece from another player can't be
// taken apart; U254 the magic circles and the portal's landing on the world map; U257 the forge's odds before forging;
// U262 the auction's kinds, price cap and sort; U276 moving a gem; U124 a fallen golem's ore vein; U190 Khan's dodge and
// party steps.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const labels = (g) => g.eval(() => {
  const G = window.__G, MM = window.SatArt.minimap, out = [], l0 = MM.label;
  MM.label = function (g2, text) { out.push(String(text)); return l0.apply(this, arguments); };
  try { G.mapBase(); G.MV.z = 1; G.mapDraw(); } finally { MM.label = l0; }
  return out;
});

test('salvage, gems, the forge odds, the auction filters, the golem vein and Khan\'s steps', async () => {
  const g = await H.openGame({});
  try {
    await g.page.setViewportSize({ width: 1600, height: 900 });
    await H.newGame(g);
    // U285: a piece rebuilt from another player's (trade, vault, a pickup) is marked by the receiver and can't be taken apart
    const sv = await g.eval(() => { const G = window.__G, S = G.S, X = window.__GP5;
      const it = X.tin(JSON.stringify({ id: 'isword', r: 1, tr: 0 })); S.items.push(it); const n0 = S.items.length;
      X.salv({ it, k: it.id, r: it.r }); return { tr: it.tr, kept: S.items.length === n0 && S.items.includes(it), tip: /another player/.test(X.tip(it)) }; });
    assert.deepEqual(sv, { tr: 1, kept: true, tip: true });

    // U276: a gem moves from the worn sword to the worn armour for the setting's fee; the armour's old gem breaks
    const gm = await g.eval(() => { const G = window.__G, S = G.S, X = window.__GP5, E = G.eqx;
      const w = E.mkItem('isword', 1), a = E.mkItem('larmor', 1); S.items.push(w, a); E.equip(w); E.equip(a); w.gem = 'ruby'; a.gem = 'topaz'; S.gold = 2000;
      X.gemMove(w, a, 'khan'); const o = { w: w.gem || null, a: a.gem, gold: S.gold };
      S.gold = 0; X.gemMove(a, w, 'khan'); o.poor = [w.gem || null, a.gem]; return o; });
    assert.deepEqual(gm, { w: null, a: 'ruby', gold: 1500, poor: [null, 'ruby'] });
    for (let i = 0; i < 8 && await g.eval(() => window.__G.mode) === 'dialog'; i++) { await g.eval(() => window.__G.advance()); await g.step(2); }

    // U257: the odds shown are what forging rolls (40,000 forgings at each score against the same function)
    const od = await g.eval(() => { const S = window.__G.S, X = window.__GP5, rc = X.rc('isword'); S.smith = 10; const o = {};
      for (const s of [1, .84, .6]) { const p = X.odds(rc, s), b = X.forgeB(rc), c = [0, 0, 0, 0, 0], N = 40000;
        for (let i = 0; i < N; i++) c[X.roll(b + s + (Math.random() - .5) * .08)]++;
        o[s] = { sum: p.reduce((a, x) => a + x, 0), d: Math.max(...p.map((x, r) => Math.abs(x - c[r] / N))), leg: p[4] }; }
      o.tip = X.oddsTip(rc); return o; });
    for (const s of ['1', '0.84', '0.6']) { assert.ok(Math.abs(od[s].sum - 1) < 1e-9, s + ' sums to 1'); assert.ok(od[s].d < .012, s + ' matches the rolls: ' + od[s].d); assert.equal(od[s].leg, 0, 'no Legendary but for Pagma\'s Successor'); }
    assert.match(od.tip, /All perfect/); assert.match(od.tip, /Rare/);

    // U262: kinds, a price cap per unit, and three sorts
    const au = await g.eval(() => { const X = window.__GP5, L = [{ id: 'a', it: 'ruby', q: 2, price: 1000, t: 3 }, { id: 'b', it: 'ore', q: 10, price: 500, t: 1 }, { id: 'c', it: 'hpot', q: 5, price: 900, t: 2 }, { id: 'd', it: 'mumbk', q: 1, price: 200000, t: 4 }];
      return { kinds: ['ruby', 'ore', 'hpot', 'mumbk', 'shnore', 'herb', 'brdrg'].map(X.kind), gem: X.shown(L, { k: 'gem' }), cap: X.shown(L, { max: 100 }), unit: X.shown(L, { s: 'unit' }), total: X.shown(L, { s: 'total' }), new: X.shown(L, { s: 'new' }) }; });
    assert.deepEqual(au, { kinds: ['gem', 'metal', 'pot', 'book', 'metal', 'farm', 'beast'], gem: ['a'], cap: ['b'], unit: ['b', 'c', 'a', 'd'], total: ['b', 'c', 'a', 'd'], new: ['d', 'a', 'c', 'b'] });

    // U124: a stone golem leaves an ore vein where it falls: one dig, then gone; unmined, it goes after three minutes
    const gv = await g.eval(() => { const G = window.__G, S = G.S, P = G.P, X = window.__GP5, N = X.nodes(), n0 = N.length;
      X.golem({ type: 'golem', x: P.x + 40, y: P.y }); const v = N[N.length - 1], o = { added: N.length - n0, gol: !!v.gol };
      X.golem({ type: 'wolf', x: P.x + 80, y: P.y }); o.wolf = N.length - n0;
      P.st = 1e4; const ore0 = S.mats.ore || 0; X.mine(v); o.ore = (S.mats.ore || 0) > ore0; X.sweep(); o.dug = N.includes(v);
      X.golem({ type: 'cgolem', x: P.x - 40, y: P.y }); const w = N[N.length - 1]; w.gol = -1; X.sweep(); o.expired = N.includes(w); return o; });
    assert.deepEqual(gv, { added: 1, gol: true, wolf: 1, ore: true, dug: false, expired: false });

    // U190: Khan's dodge step opens after his first quest; three dodges finish it. The party step waits for online play.
    const kh = await g.eval(() => { const S = window.__G.S, X = window.__GP5, o = { before: X.avail('khd') };
      S.qs.kh1 = { st: 2 }; o.after = X.avail('khd'); S.qs.khd = { st: 1, c: 0 }; for (let i = 0; i < 3; i++) X.dodge(); o.ready = X.ready('khd');
      S.qs.kh3 = { st: 2 }; o.party = X.avail('khp'); return o; });
    assert.deepEqual(kh, { before: false, after: true, ready: true, party: false });

    // U254: the world map marks the magic circles and the portal's landing once seen (the West's circle at Reinhardt...)
    await g.eval(() => { window.__GP5.fogAll(); });
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
    await g.eval(() => { const G = window.__G, c = window.__GP5.circ(); G.S.lv = 300; G.P.x = c.e.x * 16; G.P.y = (c.e.y + 3) * 16; G.P.inv = 1e9; window.__GP5.fogAll(); });
    await g.step(5);
    await g.page.keyboard.press('m'); await g.step(2);
    const E = await labels(g);
    assert.equal(E.filter((t) => t === 'Magic circle').length, 1, 'the White Tree Forest\'s circle');
    assert.ok(E.includes('Portal landing'));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
