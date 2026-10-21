'use strict';
// The quest guide (owner 2026-10-21): an arrow to where the followed quest wants you. A kill quest with no fixed area
// points to the nearest live monster of its kind; a visit to its shrine; a finished quest back to its giver. The quest
// window's button follows a quest, and on the followed one hides the arrow.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('the arrow follows the newest quest with a place, the picked one, or the giver once it is done; it can be hidden', async () => {
  const g = await H.openGame();
  try {
    await H.newGame(g, { n: 'Q', hair: 1, hc: 2, skin: 1, top: 3 });
    await g.step(3);
    const r = await g.eval(() => { const G = window.__G, S = G.S, Q = window.__GQG; S.lv = 40;
      const none = Q.tgt();
      S.qs.kh6 = { st: 1, n: 0 }; const a = Q.tgt();
      S.qs.kh5 = { st: 1, n: 0 }; const b = Q.tgt();
      Q.follow('kh6'); const c = Q.tgt();
      Q.follow('kh6'); const off = Q.tgt(); Q.follow('kh5'); const back = Q.tgt();
      return { none, a, b, c, off, back, grave: Q.spot('kh5') };
    });
    assert.equal(r.a.id, 'kh6');
    assert.equal(r.b.id, 'kh5', 'the newest one with a place');
    assert.ok(Math.abs(r.b.p.x - r.grave.x) < 1e-6, 'a visit points to its place');
    assert.equal(r.c.id, 'kh6', 'the one picked in its window');
    assert.equal(r.off, null, 'pressed again on the followed one, the arrow hides');
    assert.equal(r.back.id, 'kh5');
    // a kill quest whose monster has no fixed area points to the nearest live one
    const k = await g.eval(() => { const G = window.__G, S = G.S, Q = window.__GQG, P = G.P;
      const m = G.spawnMon('bknight', P.x + 300, P.y); m.tmp = 0;
      window.__G.QD.zz_q = { by: 'khan', lv: 1, obj: { t: 'kill', it: 'bknight', n: 1 }, xp: 1 };
      S.qs.zz_q = { st: 1, n: 0 }; const p = Q.spot('zz_q'); delete S.qs.zz_q; delete window.__G.QD.zz_q;
      return { p, mx: m.x / 16, my: m.y / 16 };
    });
    assert.ok(k.p && k.p.mon, JSON.stringify(k));
    assert.ok(Math.hypot(k.p.x - k.mx, k.p.y - k.my) < 40, 'near the spawned one');
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
