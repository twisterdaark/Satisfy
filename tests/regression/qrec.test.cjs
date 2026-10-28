'use strict';
// The recommended quest button (owner 2026-10-23, from a player's idea): one press picks a quest you can take now at your
// level, and the guide arrow leads to its giver.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../harness/game.cjs');

test.after(() => H.closeBrowser());

test('recommended quest: fits your level, is takeable, and the arrow follows it', async () => {
  const g = await H.openGame({});
  try {
    await H.newGame(g, { n: 'Grid', hair: 3, hc: 0, skin: 1, top: 1 });
    const r = await g.eval(() => {
      const G = window.__G, S = G.S, R = window.__GQREC, out = {};
      out.btn = !!document.getElementById('qRecB');
      for (const lv of [1, 40, 150]) { S.lv = lv; const q = R.rec(); out['l' + lv] = q ? { q, lv: G.QD[q].lv || 1, taken: !!S.qs[q] } : null; }
      S.lv = 40; document.getElementById('qRecB').click();
      out.trk = S.qTrk; out.tgt = window.__GQG.tgt();
      return out;
    });
    assert.ok(r.btn, 'the button is in the quest box');
    for (const k of ['l1', 'l40', 'l150']) { const x = r[k]; if (x) { assert.ok(x.lv <= +k.slice(1), JSON.stringify(r)); assert.equal(x.taken, false); } }
    assert.ok(r.l1, 'a new character gets one: ' + JSON.stringify(r));
    assert.equal(r.trk, r.l40 && r.l40.q);
    assert.ok(r.tgt && r.tgt.id === r.trk, 'the arrow follows it: ' + JSON.stringify(r.tgt));
    assert.deepEqual(g.errors, []);
  } finally { await g.close(); }
});
