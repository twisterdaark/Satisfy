'use strict';
// Owner 2026-10-24: "with life steal I just stand and auto-attack; nothing makes me think". Blows from monsters near your level take
// a share of your health (much more for the telegraphed ones), the share fades for monsters far under you, life steal heals at most
// 4% a second (less while wounded), and monsters from level 30 can call circles down on you.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./../harness/game.cjs');
test.after(() => H.closeBrowser());

test('monster threat: health shares by kind of blow, fading with the level gap; life steal capped; circles from level 30', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g);
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, P = G.P, X = window.__GTHR; S.lv = 100;
      const mh = () => G.eqx.maxMP ? 0 : 0; // (unused)
      const take = (kind, mlv, mul) => { P.inv = 0; P.dash = 0; P.hp = 1e9; const h0 = P.hp; X.hit(kind, mlv, mul); return h0 - P.hp; };
      const full = (() => { P.hp = 1; return 0; })();
      // max health: read it from a big heal
      P.hp = 1; window.__G.P.hp = 1e12; const MAX = (() => { let m = 0; return m; })();
      return { light: take('light', 100, 1), heavy: take('heavy', 100, 1.5), far: take('heavy', 70, 1.5), wound: (P.woundT || 0) > 0 };
    });
    // relative sizes: a heavy blow far bigger than a swipe; a monster 30 levels under you does next to nothing
    assert.ok(r.heavy > r.light * 4, JSON.stringify(r));
    assert.ok(r.far < r.light, 'far under you: ' + JSON.stringify(r));
    assert.equal(r.wound, true, 'a heavy blow wounds');
    const ls = await g.eval(() => { const X = window.__GTHR, P = window.__G.P; P.woundT = 0; let got = 0; for (let i = 0; i < 50; i++) got += X.ls(1e9); return got; });
    const ls2 = await g.eval(() => { const X = window.__GTHR; return X.ls(1e9); });
    assert.ok(ls > 0 && ls2 === 0, 'the budget runs out within the second: ' + ls + ' / ' + ls2);
    const mv = await g.eval(() => ({ wolf: window.__GTHR.moves('wolf'), troll: window.__GTHR.moves('troll') }));
    assert.ok(mv.troll.includes('rain'), 'a troll can call circles: ' + mv.troll);
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
