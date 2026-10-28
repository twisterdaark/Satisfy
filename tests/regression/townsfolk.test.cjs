'use strict';
// Owner 2026-10-20: townsfolk in every town who walk, talk and play with you, some who fight you (a friendly spar) and
// some who try to kill you (highwaymen outside), all the same for every player. Positions are a pure function of the
// world clock, so two separate pages agree; the highwaymen are ordinary shared monsters with the same keys everywhere.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

const snap = (g) => g.eval(() => {
  const T = window.__GT; T.tick(0.016);
  const s = 1.7e9;
  return {
    towns: T.tf().reduce((o, f) => { o[f.T] = (o[f.T] || 0) + 1; return o; }, {}),
    at: T.tf().map((f) => { const q = T.at(f, s); return f.id + ':' + Math.round(q.x) + ',' + Math.round(q.y); }),
    bandits: T.bandits().map((m) => m.type + '@' + (m.sx | 0) + ',' + (m.sy | 0)),
    towns0: window.__G.world().TOWNS.map((t) => t.k),
  };
});

test('every town has townsfolk at the same spots on two pages, and highwaymen outside', async () => {
  const a = await H.openGame(), b = await H.openGame();
  try {
    await H.newGame(a); await H.newGame(b);
    const A = await snap(a), B = await snap(b);
    for (const k of A.towns0) assert.ok((A.towns[k] || 0) >= 4, k + ' has townsfolk');
    assert.deepEqual(A.at, B.at, 'same positions for the same world time');
    // the West's towns; outside the East's (SAT-ONLINE-159) Hwang Gildong's robbers stand instead, from the East's own spawns
    assert.equal(A.bandits.length, A.towns0.filter((k) => !/^zEa/.test(k) && k !== 'zVatican').length * 3);   // v3.11: the Holy See has no ring of its own (its paladins keep it);
    assert.deepEqual(A.bandits, B.bandits, 'same highwaymen everywhere');
  } finally { await a.close(); await b.close(); }
});

test('a sparring partner fights to a quarter of health: win pays, losing costs nothing more', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g);
    const start = () => g.eval(() => {
      const G = window.__G, T = window.__GT; T.tick(0.016); const f = T.tf().find((x) => x.role === 'spar' && x.T === 'zWin');
      G.P.x = f.x + 20; G.P.y = f.y; G.P.hp = window.__G.maxHP(); T.spar(f);
      return { busy: f.busy, on: !!T.SPAR, inMons: G.mons().includes(T.SPAR.m), shared: false };
    });
    const s1 = await start();
    assert.ok(s1.busy && s1.on && s1.inMons);
    const won = await g.eval(() => { const G = window.__G, T = window.__GT, m = T.SPAR.m, g0 = G.S.gold; m.hp = Math.floor(m.max * 0.2); T.tick(0.016);
      return { gold: G.S.gold > g0, off: !T.SPAR, gone: !G.mons().includes(m) }; });
    assert.deepEqual(won, { gold: true, off: true, gone: true });
    await start();
    const lost = await g.eval(() => { const G = window.__G, T = window.__GT, g0 = G.S.gold; G.P.hp = Math.floor(G.maxHP() * 0.2); T.tick(0.016);
      return { gold: G.S.gold === g0, off: !T.SPAR, alive: G.P.hp > 0 }; });
    assert.deepEqual(lost, { gold: true, off: true, alive: true });
  } finally { await g.close(); }
});
